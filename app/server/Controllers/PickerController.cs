using Microsoft.AspNetCore.Mvc;
using OttPicker.Api.Models;
using OttPicker.Api.Services;

namespace OttPicker.Api.Controllers;

[ApiController]
[Route("api/picker")]
public sealed class PickerController(PickerService picker) : ControllerBase
{
    [HttpGet("options")]
    public ActionResult<PickerOptions> Options() => picker.GetOptions();

    [HttpPost]
    public ActionResult<PickerResponse> Pick([FromBody] PickerPreferences preferences) =>
        picker.Pick(preferences);
}
