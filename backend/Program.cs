using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using DspWeb.Game;

var sim = new Simulation();

// 60Hz 模拟循环（2D 工厂）
var loop = Task.Run(async () =>
{
    var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(1000.0 / 60.0));
    long last = Environment.TickCount64;
    while (await timer.WaitForNextTickAsync())
    {
        long now = Environment.TickCount64;
        double speed = sim.Speed;
        double ticks = Math.Clamp((now - last) * 60 / 1000.0 * speed, 0, 20);
        last = now;
        if (ticks > 0 && sim.Running) sim.Tick(ticks);
    }
});

// ---------- 多人：账号 + 房间 ----------
var accounts = new ConcurrentDictionary<string, (string PassHash, string Color)>(); // user -> (sha256(password), color)
var tokens = new ConcurrentDictionary<string, string>();                            // token -> user
var rooms = new ConcurrentDictionary<string, ConcurrentDictionary<string, PlayerState>>(); // room -> id -> state

static string Sha256(string s) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(s)));

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
var app = builder.Build();
app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles();

// 2D 工厂 API
app.MapGet("/api/protos", () => new
{
    items = Protos.Items,
    recipes = Protos.Recipes.Select(r => new
    {
        r.Id, r.Name, type = r.Type.ToString(), timeSpend = r.TimeSpend,
        @in = r.In, @out = r.Out,
    }),
    beltCellsPerSec = Protos.BeltCellsPerSec,
    minerItemsPerSec = Protos.MinerItemsPerSec,
});
app.MapGet("/api/state", () => sim.Snapshot());
app.MapPost("/api/place", (PlaceReq req) => Results.Text(sim.Place(req.X, req.Y, Enum.Parse<EType>(req.Type, true), (EDir)req.Dir, req.RecipeId)));
app.MapPost("/api/remove", (RemoveReq req) => Results.Text(sim.Remove(req.X, req.Y)));
app.MapPost("/api/run", (RunReq req) => { sim.SetRunning(req.Running); return Results.Text("ok"); });
app.MapPost("/api/speed", (SpeedReq req) => { sim.SetSpeed(req.Value); return Results.Text("ok"); });

// 账号
app.MapPost("/api/register", (RegReq req) =>
{
    var user = req.User.Trim();
    if (user.Length < 2 || user.Length > 20) return Results.Json(new { ok = false, msg = "用户名 2~20 字符" });
    if (req.Pass.Length < 3) return Results.Json(new { ok = false, msg = "密码至少 3 位" });
    if (!accounts.TryAdd(user, (Sha256(req.Pass), req.Color ?? "#e05656")))
        return Results.Json(new { ok = false, msg = "用户名已存在" });
    var token = Guid.NewGuid().ToString("N");
    tokens[token] = user;
    return Results.Json(new { ok = true, token, user, color = req.Color ?? "#e05656" });
});

app.MapPost("/api/login", (RegReq req) =>
{
    if (!accounts.TryGetValue(req.User.Trim(), out var acc) || acc.PassHash != Sha256(req.Pass))
        return Results.Json(new { ok = false, msg = "用户名或密码错误" });
    var token = Guid.NewGuid().ToString("N");
    tokens[token] = req.User.Trim();
    return Results.Json(new { ok = true, token, user = req.User.Trim(), color = acc.Color });
});

// 染色
app.MapPost("/api/profile", (ProfileReq req) =>
{
    if (!tokens.TryGetValue(req.Token, out var user) || !accounts.TryGetValue(user, out var acc))
        return Results.Json(new { ok = false, msg = "未登录" });
    accounts[user] = (acc.PassHash, req.Color);
    return Results.Json(new { ok = true, color = req.Color });
});

// 房间同步：带上自己的状态，返回同房间其他玩家（超过 10 秒没心跳的自动剔除）
app.MapPost("/api/sync", (SyncReq req) =>
{
    if (!tokens.TryGetValue(req.Token, out var user)) return Results.Json(new { ok = false, msg = "未登录" });
    var room = rooms.GetOrAdd(req.Room ?? "room1", _ => new());
    var now = Environment.TickCount64;
    var id = user; // 每账号一个实体
    room[id] = new PlayerState(id, user, req.Color ?? "#e05656", req.Pos ?? [0, 0, 60], req.Yaw, now);
    // 清理掉线玩家
    foreach (var kv in room)
        if (now - kv.Value.LastSeen > 10_000) room.TryRemove(kv.Key, out _);
    var others = room.Values
        .Where(p => p.Id != id)
        .Select(p => new { p.Id, p.Name, p.Color, p.Pos, p.Yaw })
        .ToArray();
    return Results.Json(new { ok = true, room = req.Room ?? "room1", others });
});

app.Run(); // 监听地址由 ASPNETCORE_URLS 决定（Docker 里为 0.0.0.0:8080，本地开发默认见 launchSettings）

record PlaceReq(int X, int Y, string Type, int Dir, int? RecipeId);
record RemoveReq(int X, int Y);
record RunReq(bool Running);
record SpeedReq(double Value);
record RegReq(string User, string Pass, string? Color);
record ProfileReq(string Token, string Color);
record SyncReq(string Token, string? Room, string? Color, double[]? Pos, double Yaw);

record PlayerState(string Id, string Name, string Color, double[] Pos, double Yaw, long LastSeen);
