namespace OttPicker.Api.Models;

public sealed class PickerPreferences
{
    public int Screens { get; init; } = 1;
    public bool AdsOk { get; init; }
    public bool NeedsTv { get; init; }
    public List<string> Languages { get; init; } = [];
    public bool Cricket { get; init; }
    public decimal? Budget { get; init; }
    public bool AllowUnverified { get; init; }
    public int People { get; init; } = 1;
}

public sealed class PlanCandidate
{
    public required string PlatformId { get; init; }
    public required string PlanName { get; init; }
    public decimal? PricePerMonth { get; init; }
    public int? MaxScreens { get; init; }
    public bool? HasAds { get; init; }
    public string? Devices { get; init; }
    public string? BillingPeriod { get; init; }
    public string? MaxQuality { get; init; }
}

public sealed class PlatformRow
{
    public required string PlatformId { get; init; }
    public required string Name { get; init; }
    public string? Languages { get; init; }
    public bool? HasLiveCricket { get; init; }
}

public sealed class UnverifiedFact
{
    public required string PlatformId { get; init; }
    public required string Need { get; init; }
}

public sealed class PlanCombination
{
    public required List<PlanCandidate> Plans { get; init; }
    public decimal Total { get; init; }
    public required List<UnverifiedFact> Unverified { get; init; }
    public int Size { get; init; }
}

public sealed class ExcludedPlatform
{
    public required string PlatformId { get; init; }
    public required List<string> Reasons { get; init; }
}

public sealed class PickerResponse
{
    public required string Status { get; init; }
    public PlanCombination? Best { get; init; }
    public required List<PlanCombination> Alternatives { get; init; }
    public PlanCombination? CheapestValid { get; init; }
    public required List<ExcludedPlatform> Excluded { get; init; }
}

public sealed class PickerOptions
{
    public required List<string> Languages { get; init; }
    public required string PricesChecked { get; init; }
}
