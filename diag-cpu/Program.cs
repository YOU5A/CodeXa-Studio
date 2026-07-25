using System.Diagnostics;

// Test 1: PerformanceCounter - find correct category name
Console.WriteLine("=== PerformanceCounter Categories ===");
try
{
    var cats = PerformanceCounterCategory.GetCategories();
    foreach (var cat in cats)
    {
        if (cat.CategoryName.IndexOf("rocesso", StringComparison.OrdinalIgnoreCase) >= 0 ||
            cat.CategoryName.IndexOf("rocess", StringComparison.OrdinalIgnoreCase) >= 0 ||
            cat.CategoryName.IndexOf("CPU", StringComparison.OrdinalIgnoreCase) >= 0 ||
            cat.CategoryName.IndexOf("Total", StringComparison.OrdinalIgnoreCase) >= 0)
        {
            Console.WriteLine($"  Found: '{cat.CategoryName}' ({cat.CategoryType})");
            try
            {
                var instances = cat.GetInstanceNames();
                Console.WriteLine($"    Instances: {string.Join(", ", instances.Take(10))}");
            }
            catch { Console.WriteLine("    (cannot list instances)"); }
        }
    }
}
catch (Exception e) { Console.WriteLine($"Error: {e.Message}"); }

// Test 2: Try PerformanceCounter by index
Console.WriteLine("\n=== Try by Index ===");
try {
    // Category 238 = "Processor" on English systems
    for (int idx = 230; idx <= 250; idx++)
    {
        try
        {
            var counter = new PerformanceCounter(
                PerformanceCounterCategory.GetCategories().First(c => 
                    c.CategoryName.IndexOf("rocess", StringComparison.OrdinalIgnoreCase) >= 0
                ).CategoryName,
                "% Processor Time",
                "_Total"
            );
            Console.WriteLine($"  SUCCESS: {counter.CategoryName}, {counter.CounterName}, {counter.InstanceName}");
            Console.WriteLine($"  NextValue(): {counter.NextValue()}");
            Thread.Sleep(200);
            Console.WriteLine($"  NextValue()#2: {counter.NextValue()}");
            break;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"  Index {idx} failed: {ex.Message}");
        }
    }
}
catch (Exception e) { Console.WriteLine($"Error: {e.Message}"); }
