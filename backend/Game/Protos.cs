namespace DspWeb.Game;

/// <summary>
/// 物品与配方原型表。数值取自戴森球计划（60 tick/s，TimeSpend 以 1/60 秒为单位的 tick 数）。
/// 参考 Assembly-CSharp.dll: RecipeProto.TimeSpend / RecipeExecuteData(timeSpend*10000), BeltComponent.speed (1=6/s, 2=12/s, 5=30/s)。
/// </summary>
public static class Protos
{
    public record ItemDef(int Id, string Name, string Color, bool IsRaw);

    // 物品（自编 ID，数值沿用 DSP 公认参数）
    public static readonly ItemDef[] Items =
    {
        new(1, "铁矿",   "#5a4636", true),
        new(2, "铜矿",   "#8a4b28", true),
        new(3, "铁块",   "#b8bcc2", false),
        new(4, "铜块",   "#d98e4a", false),
        new(5, "齿轮",   "#e0a03a", false),
        new(6, "磁铁",   "#7fb2e0", false),
        new(7, "电路板", "#4fae6b", false),
        new(8, "钢材",   "#7d8894", false),
    };

    public record RecipeDef(int Id, string Name, ERecipeType Type, int TimeSpend,
        (int item, int count)[] In, (int item, int count)[] Out);

    public enum ERecipeType { Smelt, Assemble }

    // 配方：TimeSpend = 游戏 tick 数（60 tick = 1 秒）
    public static readonly RecipeDef[] Recipes =
    {
        new(101, "铁块",   ERecipeType.Smelt,    60, [(1,1)], [(3,1)]),
        new(102, "铜块",   ERecipeType.Smelt,    60, [(2,1)], [(4,1)]),
        new(103, "磁铁",   ERecipeType.Smelt,    60, [(3,1)], [(6,1)]),
        new(104, "钢材",   ERecipeType.Smelt,   180, [(3,3)], [(8,1)]),
        new(201, "齿轮",   ERecipeType.Assemble, 60, [(3,2)], [(5,1)]),
        new(202, "电路板", ERecipeType.Assemble, 60, [(3,1),(4,1)], [(7,1)]),
    };

    // 传送带速度：cells/秒（DSP: Mk1=6, Mk2=12, Mk3=30）
    public const double BeltCellsPerSec = 6.0;
    // 采矿机：0.5 件/秒（DSP 基础值）
    public const double MinerItemsPerSec = 0.5;
    // 冶炼炉 1.0x，制造台 MkI 0.75x（DSP 公认系数）
    public const double SmelterSpeed = 1.0;
    public const double AssemblerSpeed = 0.75;

    public static RecipeDef? Recipe(int id) => Recipes.FirstOrDefault(r => r.Id == id);
    public static ItemDef? Item(int id) => Items.FirstOrDefault(i => i.Id == id);
}
