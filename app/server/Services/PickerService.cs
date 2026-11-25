using System.Text.Json;
using OttPicker.Api.Models;

namespace OttPicker.Api.Services;

public sealed class PickerService
{
    private readonly List<PlatformRow> _platforms;
    private readonly List<PlanCandidate> _plans;
    private readonly string _pricesChecked;

    public PickerService(IHostEnvironment environment)
    {
        var root = FindRepositoryRoot(environment.ContentRootPath);
        if (root is null)
            throw new InvalidOperationException("Repository root could not be found.");

        var dataDirectory = Path.Combine(root.FullName, "dashboard", "data");
        _platforms = LoadJson<List<PlatformRow>>(Path.Combine(dataDirectory, "platforms.json"));
        var priceRows = LoadJson<List<PriceRow>>(Path.Combine(dataDirectory, "prices.json"));
        var meta = LoadJson<MetaRow>(Path.Combine(dataDirectory, "meta.json"));
        _pricesChecked = meta.PricesChecked ?? "unknown";
        _plans = priceRows.Select(ToCandidate).ToList();
    }

    public PickerOptions GetOptions()
    {
        var languages = _platforms
            .SelectMany(row => Split(row.Languages))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(name => name)
            .ToList();
        return new PickerOptions { Languages = languages, PricesChecked = _pricesChecked };
    }

    public PickerResponse Pick(PickerPreferences preferences)
    {
        var platformsById = _platforms.ToDictionary(row => row.PlatformId, StringComparer.Ordinal);
        var best = new Dictionary<string, (PlanCandidate Plan, Dictionary<string, string> Checks)>(StringComparer.Ordinal);
        var reasons = new Dictionary<string, HashSet<string>>(StringComparer.Ordinal);

        foreach (var plan in _plans)
        {
            if (plan.PricePerMonth is null || !platformsById.ContainsKey(plan.PlatformId))
                continue;

            var checks = CheckPlan(plan, preferences);
            var failed = checks.Where(check => !Accepts(check.Value, preferences.AllowUnverified)).ToList();
            if (failed.Count > 0)
            {
                if (!reasons.TryGetValue(plan.PlatformId, out var set))
                {
                    set = new HashSet<string>(StringComparer.Ordinal);
                    reasons[plan.PlatformId] = set;
                }
                foreach (var (need, answer) in failed)
                    set.Add($"{need}:{answer}");
                continue;
            }

            if (!best.TryGetValue(plan.PlatformId, out var current) ||
                plan.PricePerMonth < current.Plan.PricePerMonth)
                best[plan.PlatformId] = (plan, checks);
        }

        var ids = best.Keys.OrderBy(id => id).ToList();
        var combinations = new List<PlanCombination>();
        for (var mask = 1; mask < 1 << ids.Count; mask++)
        {
            var entries = ids.Where((_, index) => (mask & (1 << index)) != 0)
                .Select(id => best[id]).ToList();
            var coverage = Coverage(entries.Select(entry => entry.Plan).ToList(),
                entries.Select(entry => entry.Checks).ToList(),
                platformsById, preferences);
            if (coverage.Missing.Count > 0)
                continue;

            var total = Math.Round(entries.Sum(entry => entry.Plan.PricePerMonth ?? 0m), 2);
            combinations.Add(new PlanCombination
            {
                Plans = entries.Select(entry => entry.Plan).ToList(),
                Total = total,
                Unverified = coverage.Unverified,
                Size = entries.Count
            });
        }

        var minimal = combinations
            .Where(candidate => !combinations.Any(other =>
                other.Size < candidate.Size &&
                other.Plans.All(plan => candidate.Plans.Contains(plan)) &&
                other.Total <= candidate.Total))
            .OrderBy(candidate => candidate.Unverified.Count)
            .ThenBy(candidate => candidate.Total)
            .ThenBy(candidate => candidate.Size)
            .ToList();

        var excluded = _platforms
            .Where(platform => !best.ContainsKey(platform.PlatformId))
            .Select(platform =>
            {
                List<string> platformReasons;
                if (reasons.TryGetValue(platform.PlatformId, out var set))
                    platformReasons = set.OrderBy(reason => reason).ToList();
                else if (_plans.Any(plan => plan.PlatformId == platform.PlatformId && plan.PricePerMonth is not null))
                    platformReasons = [];
                else
                    platformReasons = ["price:unknown"];
                return new ExcludedPlatform { PlatformId = platform.PlatformId, Reasons = platformReasons };
            })
            .ToList();

        var cheapestValid = minimal.FirstOrDefault();
        if (cheapestValid is null)
            return NoMatch(excluded);

        var affordable = minimal
            .Where(candidate => preferences.Budget is null || candidate.Total <= preferences.Budget)
            .ToList();
        if (affordable.Count == 0)
        {
            return new PickerResponse
            {
                Status = "over_budget",
                Best = null,
                Alternatives = [],
                CheapestValid = cheapestValid,
                Excluded = excluded
            };
        }

        return new PickerResponse
        {
            Status = "ok",
            Best = affordable[0],
            Alternatives = affordable.Skip(1).Take(2).ToList(),
            CheapestValid = cheapestValid,
            Excluded = excluded
        };
    }

    private static PickerResponse NoMatch(List<ExcludedPlatform> excluded) =>
        new() { Status = "no_match", Best = null, Alternatives = [], CheapestValid = null, Excluded = excluded };

    private static Dictionary<string, string> CheckPlan(PlanCandidate plan, PickerPreferences preferences)
    {
        var screens = preferences.Screens <= 1
            ? "yes"
            : plan.MaxScreens is null ? "unknown"
            : plan.MaxScreens >= preferences.Screens ? "yes" : "no";
        var ads = preferences.AdsOk
            ? "yes"
            : plan.HasAds is null ? "unknown"
            : plan.HasAds.Value ? "no" : "yes";
        var tv = !preferences.NeedsTv
            ? "yes"
            : plan.Devices is null ? "unknown"
            : plan.Devices == "all" ? "yes" : "no";
        return new Dictionary<string, string>
        {
            ["screens"] = screens,
            ["ads"] = ads,
            ["tv"] = tv
        };
    }

    private static (List<string> Missing, List<UnverifiedFact> Unverified) Coverage(
        List<PlanCandidate> entries,
        List<Dictionary<string, string>> checks,
        Dictionary<string, PlatformRow> platformsById,
        PickerPreferences preferences)
    {
        var unverified = new List<UnverifiedFact>();
        for (var index = 0; index < entries.Count; index++)
        {
            foreach (var (need, answer) in checks[index])
                if (answer == "unknown")
                    unverified.Add(new UnverifiedFact { PlatformId = entries[index].PlatformId, Need = need });
        }

        var missing = new List<string>();
        foreach (var language in preferences.Languages)
        {
            var answers = entries.Select(plan =>
            {
                platformsById.TryGetValue(plan.PlatformId, out var platform);
                return (plan.PlatformId, Answer: PlatformLanguage(platform, language));
            }).ToList();

            if (answers.Any(answer => answer.Answer == "yes"))
                continue;
            var maybe = answers.FirstOrDefault(answer => answer.Answer == "unknown");
            if (preferences.AllowUnverified && maybe.PlatformId is not null)
                unverified.Add(new UnverifiedFact { PlatformId = maybe.PlatformId, Need = $"language:{language}" });
            else
                missing.Add($"language:{language}");
        }

        if (preferences.Cricket)
        {
            var answers = entries.Select(plan =>
            {
                platformsById.TryGetValue(plan.PlatformId, out var platform);
                return (plan.PlatformId, Answer: platform?.HasLiveCricket switch
                {
                    true => "yes",
                    false => "no",
                    null => "unknown"
                });
            }).ToList();

            if (!answers.Any(answer => answer.Answer == "yes"))
            {
                var maybe = answers.FirstOrDefault(answer => answer.Answer == "unknown");
                if (preferences.AllowUnverified && maybe.PlatformId is not null)
                    unverified.Add(new UnverifiedFact { PlatformId = maybe.PlatformId, Need = "cricket" });
                else
                    missing.Add("cricket");
            }
        }
        return (missing, unverified);
    }

    private static string PlatformLanguage(PlatformRow? platform, string language)
    {
        var languages = Split(platform?.Languages);
        if (languages.Count == 0)
            return "unknown";
        return languages.Contains(language, StringComparer.Ordinal) ? "yes" : "no";
    }

    private static bool Accepts(string answer, bool allowUnverified) =>
        answer == "yes" || (allowUnverified && answer == "unknown");

    private static List<string> Split(string? value) =>
        value?.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList() ?? [];

    private static PlanCandidate ToCandidate(PriceRow row)
    {
        decimal? perMonth = row.PriceInr is null ? null : row.BillingPeriod switch
        {
            "month" => row.PriceInr,
            "quarter" => Math.Round(row.PriceInr.Value / 3m, 2),
            "year" => Math.Round(row.PriceInr.Value / 12m, 2),
            _ => null
        };
        return new PlanCandidate
        {
            PlatformId = row.PlatformId,
            PlanName = row.PlanName,
            PricePerMonth = perMonth,
            MaxScreens = row.MaxScreens,
            HasAds = row.HasAds,
            Devices = row.Devices,
            BillingPeriod = row.BillingPeriod,
            MaxQuality = row.MaxQuality
        };
    }

    private static T LoadJson<T>(string path)
    {
        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
        }) ?? throw new InvalidOperationException($"Could not read JSON: {path}");
    }

    private static DirectoryInfo? FindRepositoryRoot(string start)
    {
        var current = new DirectoryInfo(start);
        while (current is not null)
        {
            if (Directory.Exists(Path.Combine(current.FullName, "dashboard", "data")))
                return current;
            current = current.Parent;
        }
        return null;
    }

    private sealed class PriceRow
    {
        public string PlatformId { get; init; } = "";
        public string PlanName { get; init; } = "";
        public decimal? PriceInr { get; init; }
        public string? BillingPeriod { get; init; }
        public int? MaxScreens { get; init; }
        public bool? HasAds { get; init; }
        public string? Devices { get; init; }
        public string? MaxQuality { get; init; }
    }

    private sealed class MetaRow
    {
        public string? PricesChecked { get; init; }
    }
}
