using Depmap.Scanning;
using Depmap.Service.Configuration;
using Depmap.Service.Services;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<MonitorOptions>(builder.Configuration.GetSection(MonitorOptions.SectionName));
builder.Services.AddSingleton<DepmapScanner>();
builder.Services.AddSingleton<MonitorState>();
builder.Services.AddHostedService<FolderMonitorService>();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/status", (MonitorState state) => Results.Ok(state.GetStatus()));

app.MapGet("/api/graph", (MonitorState state) =>
{
    return state.TryGetGraphJson(out var graphJson)
        ? Results.Content(graphJson, "application/json")
        : Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
});

app.MapGet("/api/updates", async (HttpContext context, MonitorState state) =>
{
    context.Response.Headers.ContentType = "text/event-stream";
    context.Response.Headers.CacheControl = "no-cache";

    var observedVersion = state.GetStatus().Version;
    while (!context.RequestAborted.IsCancellationRequested)
    {
        var nextVersion = await state.WaitForChangeAsync(observedVersion, context.RequestAborted);
        observedVersion = nextVersion;

        var payload = JsonSerializer.Serialize(state.GetStatus());
        await context.Response.WriteAsync($"event: status{Environment.NewLine}", context.RequestAborted);
        await context.Response.WriteAsync($"data: {payload}{Environment.NewLine}{Environment.NewLine}", context.RequestAborted);
        await context.Response.Body.FlushAsync(context.RequestAborted);
    }
});

app.Run();
