using System.Collections.Concurrent;

namespace DspWeb.Game;

public enum EType { Miner, Smelter, Assembler, Belt, Storage }
public enum EDir { Right = 0, Down = 1, Left = 2, Up = 3 }

public class BeltItem
{
    public int ItemId { get; set; }
    public double Pos { get; set; } // 0..1 在格子内的前进位置
}

public class Entity
{
    public int X { get; set; }
    public int Y { get; set; }
    public EType Type { get; set; }
    public EDir Dir { get; set; }
    public int? RecipeId { get; set; }

    // 机器状态
    public Dictionary<int, int> InputBuf { get; } = new();
    public Dictionary<int, int> OutputBuf { get; } = new();
    public long ProgressTicks { get; set; }
    public bool Replicating { get; set; }

    // 传送带状态：按位置从大到小（头部在前）
    public List<BeltItem> BeltSlots { get; } = new();

    public const int BufCap = 20;        // 每种物品缓冲上限
    public const double MinSpacing = 0.25; // 带上物品最小间距（DSP 4 格/带单元的简化）

    public bool InputAccept(int itemId)
    {
        var r = RecipeId == null ? null : Protos.Recipe(RecipeId.Value);
        if (r == null) return InputBuf.GetValueOrDefault(itemId) < BufCap; // 仓库
        return r.In.Any(i => i.item == itemId) && InputBuf.GetValueOrDefault(itemId) < BufCap;
    }
}

public record OrePatch(int X, int Y, int ItemId);

public class Simulation
{
    public const int W = 48, H = 32;
    private readonly object _lock = new();
    private readonly Dictionary<(int x, int y), Entity> _cells = new();
    private readonly List<OrePatch> _ore = new();
    private long _ticks;
    private readonly ConcurrentDictionary<int, int> _producedTotal = new();
    public volatile bool Running = true;
    public double Speed = 1.0; // 1x 2x 5x

    public Simulation() { SeedOre(); }

    private void SeedOre()
    {
        for (int x = 2; x < 10; x++) for (int y = 2; y < 10; y++) _ore.Add(new(x, y, 1));      // 铁矿区
        for (int x = 38; x < 46; x++) for (int y = 2; y < 10; y++) _ore.Add(new(x, y, 2));    // 铜矿区
        for (int x = 2; x < 10; x++) for (int y = 22; y < 30; y++) _ore.Add(new(x, y, 1));    // 第二铁矿区
    }

    public bool InOre(int x, int y) => _ore.Any(o => o.X == x && o.Y == y);
    public int OreAt(int x, int y) => _ore.FirstOrDefault(o => o.X == x && o.Y == y)?.ItemId ?? 0;

    // ---------- 操作 API ----------
    public string Place(int x, int y, EType type, EDir dir, int? recipeId)
    {
        lock (_lock)
        {
            if (x < 0 || y < 0 || x >= W || y >= H) return "out of bounds";
            if (type == EType.Miner && !InOre(x, y)) return "采矿机必须建在矿上";
            if (type == EType.Smelter && recipeId is { } r && Protos.Recipe(r)?.Type != Protos.ERecipeType.Smelt) return "冶炼炉只能用冶炼配方";
            if (type == EType.Assembler && recipeId is { } a && Protos.Recipe(a)?.Type != Protos.ERecipeType.Assemble) return "制造台只能用制造配方";
            _cells.Remove((x, y));
            var e = new Entity { X = x, Y = y, Type = type, Dir = dir, RecipeId = recipeId };
            _cells[(x, y)] = e;
            return "ok";
        }
    }

    public string Remove(int x, int y)
    {
        lock (_lock) { _cells.Remove((x, y)); return "ok"; }
    }

    public void SetRunning(bool running) { Running = running; }
    public void SetSpeed(double s) { Speed = s; }

    // ---------- 模拟 ----------
    public void Tick(double ticks)
    {
        lock (_lock)
        {
            double dtSec = ticks / 60.0;
            double beltDelta = dtSec * Protos.BeltCellsPerSec;
            _ticks += (long)ticks;

            foreach (var e in _cells.Values)
            {
                switch (e.Type)
                {
                    case EType.Miner: TickMiner(e, ticks); break;
                    case EType.Smelter: TickMachine(e, ticks, Protos.SmelterSpeed); break;
                    case EType.Assembler: TickMachine(e, ticks, Protos.AssemblerSpeed); break;
                    case EType.Belt: break; // 统一阶段处理
                }
            }
            // 传送带统一按行进顺序移动（从输出端开始以避免同格内竞争），此处简化：所有带同 tick 内先机器出料，再带移动
            foreach (var e in _cells.Values) if (e.Type == EType.Belt) MoveBelt(e, beltDelta);
        }
    }

    private void TickMiner(Entity e, double ticks)
    {
        // 每次积攒满 1 件的能量就产出 1 件（0.5 件/秒）
        double per = Protos.MinerItemsPerSec * ticks / 60.0;
        long acc = e.ProgressTicks + (long)(per * 1_000_000);
        e.ProgressTicks = acc % 1_000_000;
        int count = (int)(acc / 1_000_000);
        int ore = OreAt(e.X, e.Y);
        // 只有下游收得下才推进采矿进度（避免堵住时丢料）
        while (count > 0 && PushOut(e, ore)) count--;
    }

    private void TickMachine(Entity e, double ticks, double speed)
    {
        var r = Protos.Recipe(e.RecipeId ?? 0);
        if (r == null) return;

        if (!e.Replicating)
        {
            // 检查原料是否齐全
            if (r.In.All(i => e.InputBuf.GetValueOrDefault(i.item) >= i.count))
            {
                foreach (var (item, count) in r.In) e.InputBuf[item] -= count;
                e.ProgressTicks = 0;
                e.Replicating = true;
            }
            else return;
        }

        // 参考 AssemblerComponent：进度累加，溢出结转 extraTime
        long inc = (long)Math.Round(r.TimeSpend * speed * ticks / 60.0 * 1000);
        e.ProgressTicks += inc;
        long need = r.TimeSpend * 1000L;
        if (e.ProgressTicks >= need)
        {
            long cycles = e.ProgressTicks / need;
            e.ProgressTicks %= need;
            e.Replicating = false;
            foreach (var (item, count) in r.Out)
                for (int i = 0; i < (int)(count * Math.Min(cycles, 5)); i++)
                    PushOut(e, item);
            _producedTotal.AddOrUpdate(r.Out[0].item, (int)(r.Out[0].count * Math.Min(cycles, 5)), (_, v) => v + (int)(r.Out[0].count * Math.Min(cycles, 5)));
        }
    }

    /// 机器出料：向 Dir 方向的相邻格子投放（带/仓库/机器缓冲）。返回是否投出。
    private bool PushOut(Entity e, int itemId)
    {
        var (nx, ny) = Step(e.X, e.Y, e.Dir);
        if (!_cells.TryGetValue((nx, ny), out var target)) return false;
        switch (target.Type)
        {
            case EType.Belt:
                var last = target.BeltSlots.LastOrDefault();
                if (last == null || last.Pos >= Entity.MinSpacing)
                { target.BeltSlots.Add(new BeltItem { ItemId = itemId, Pos = 0 }); return true; }
                return false;
            case EType.Storage:
                if (target.InputBuf.GetValueOrDefault(itemId) < Entity.BufCap * 10)
                { target.InputBuf[itemId] = target.InputBuf.GetValueOrDefault(itemId) + 1; return true; }
                return false;
            case EType.Smelter or EType.Assembler:
                if (target.InputAccept(itemId))
                { target.InputBuf[itemId] = target.InputBuf.GetValueOrDefault(itemId) + 1; return true; }
                return false;
            default: return false;
        }
    }

    private void MoveBelt(Entity e, double delta)
    {
        // 从头部到尾部推进
        for (int i = 0; i < e.BeltSlots.Count; i++)
        {
            var it = e.BeltSlots[i];
            it.Pos += delta;
            // 与前一个物品保持间距
            if (i > 0 && it.Pos > e.BeltSlots[i - 1].Pos - Entity.MinSpacing)
                it.Pos = e.BeltSlots[i - 1].Pos - Entity.MinSpacing;

            if (it.Pos >= 1.0)
            {
                var (nx, ny) = Step(e.X, e.Y, e.Dir);
                if (_cells.TryGetValue((nx, ny), out var next))
                {
                    bool transferred = false;
                    switch (next.Type)
                    {
                        case EType.Belt:
                            var tail = next.BeltSlots.LastOrDefault();
                            if (tail == null || tail.Pos >= Entity.MinSpacing)
                            {
                                next.BeltSlots.Add(new BeltItem { ItemId = it.ItemId, Pos = it.Pos - 1 });
                                transferred = true;
                            }
                            break;
                        case EType.Storage:
                            if (next.InputBuf.GetValueOrDefault(it.ItemId) < Entity.BufCap * 10)
                            { next.InputBuf[it.ItemId] = next.InputBuf.GetValueOrDefault(it.ItemId) + 1; transferred = true; }
                            break;
                        case EType.Smelter or EType.Assembler:
                            if (next.InputAccept(it.ItemId))
                            { next.InputBuf[it.ItemId] = next.InputBuf.GetValueOrDefault(it.ItemId) + 1; transferred = true; }
                            break;
                        case EType.Miner:
                            transferred = false;
                            break;
                    }
                    if (transferred)
                    {
                        e.BeltSlots.RemoveAt(i);
                        i--;
                        continue;
                    }
                }
                it.Pos = 1.0; // 堵住
            }
        }
    }

    private static (int, int) Step(int x, int y, EDir d) => d switch
    {
        EDir.Right => (x + 1, y),
        EDir.Down => (x, y + 1),
        EDir.Left => (x - 1, y),
        _ => (x, y - 1),
    };

    // ---------- 快照 ----------
    public object Snapshot()
    {
        lock (_lock)
        {
            return new
            {
                w = W,
                h = H,
                ticks = _ticks,
                running = Running,
                speed = Speed,
                ore = _ore,
                cells = _cells.Values.Select(e => new
                {
                    e.X, e.Y,
                    type = e.Type.ToString(),
                    dir = (int)e.Dir,
                    recipeId = e.RecipeId,
                    progress = e.Type is EType.Smelter or EType.Assembler && e.RecipeId is { } rid
                        ? Math.Min(1.0, (double)e.ProgressTicks / (Protos.Recipe(rid)!.TimeSpend * 1000L))
                        : 0.0,
                    input = e.InputBuf.Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key, kv => kv.Value),
                    output = e.OutputBuf.Where(kv => kv.Value > 0).ToDictionary(kv => kv.Key, kv => kv.Value),
                    belt = e.Type == EType.Belt
                        ? e.BeltSlots.Select(b => new { b.ItemId, b.Pos })
                        : null,
                }),
                produced = _producedTotal.Where(kv => kv.Key > 0).ToDictionary(kv => kv.Key, kv => kv.Value),
            };
        }
    }
}
