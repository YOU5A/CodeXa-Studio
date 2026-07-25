namespace CodeXaBridge.Services;

public class AdminService
{
    public Dictionary<string, object?> Check(Dictionary<string, object?> p)
        => new() { ["is_admin"] = RegistryService.IsAdmin() ? 1 : 0 };

    public Dictionary<string, object?> Restart(Dictionary<string, object?> p)
    {
        if (RegistryService.IsAdmin())
            return new Dictionary<string, object?> { ["success"] = true, ["already_admin"] = true };

        return new Dictionary<string, object?>
        {
            ["success"] = false,
            ["requires_admin"] = true,
            ["message"] = "Administrator privileges required. Please restart CodeXa Studio as Administrator.",
        };
    }
}
