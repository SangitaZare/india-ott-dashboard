using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using OttPicker.Api.Models;
using OttPicker.Api.Services;

namespace OttPicker.Api.Tests;

public sealed class PickerServiceTests
{
    private readonly PickerService _picker = new(new TestHostEnvironment());

    [Fact]
    public void OptionsContainsLanguagesAndPriceDate()
    {
        var options = _picker.GetOptions();

        Assert.Contains("Hindi", options.Languages);
        Assert.NotEqual("unknown", options.PricesChecked);
    }

    [Fact]
    public void UnknownLanguageReturnsNoMatch()
    {
        var response = _picker.Pick(new PickerPreferences
        {
            Screens = 1,
            AdsOk = true,
            Languages = ["Klingon"]
        });

        Assert.Equal("no_match", response.Status);
        Assert.Null(response.Best);
    }

    [Fact]
    public void TooLowBudgetReturnsOverBudget()
    {
        var response = _picker.Pick(new PickerPreferences
        {
            Screens = 1,
            AdsOk = true,
            Languages = [],
            Budget = 1m
        });

        Assert.Equal("over_budget", response.Status);
        Assert.NotNull(response.CheapestValid);
        Assert.Null(response.Best);
    }

    [Fact]
    public void EmptyOrImpossibleLanguageDoesNotThrow()
    {
        var response = _picker.Pick(new PickerPreferences
        {
            Screens = 1,
            AdsOk = true,
            Languages = ["Not a real language"]
        });

        Assert.Equal("no_match", response.Status);
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "OttPicker.Api.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } =
            new PhysicalFileProvider(AppContext.BaseDirectory);
    }
}
