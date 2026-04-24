using Depmap.Scanning;
using Depmap.Service.Configuration;
using Depmap.Service.Services;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<MonitorOptions>(builder.Configuration.GetSection(MonitorOptions.SectionName));
builder.Services.AddSingleton<DepmapScanner>();
builder.Services.AddSingleton<MonitorState>();
builder.Services.AddSingleton<FolderMonitorService>();
builder.Services.AddSingleton<IMonitorControl>(static services => services.GetRequiredService<FolderMonitorService>());
builder.Services.AddHostedService(static services => services.GetRequiredService<FolderMonitorService>());
builder.Services.AddCors(options =>
{
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
    options.AddDefaultPolicy(policy =>
    {
        if (allowedOrigins is { Length: > 0 })
        {
            policy.WithOrigins(allowedOrigins);
        }
        else
        {
            policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173", "http://127.0.0.1:4173");
        }

        policy.AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();
app.UseCors();

app.MapGet("/api/status", (MonitorState state) => Results.Ok(state.GetStatus()));

app.MapGet("/api/graph", (MonitorState state) =>
{
    return state.TryGetGraphJson(out var graphJson)
        ? Results.Content(graphJson, "application/json")
        : Results.StatusCode(StatusCodes.Status503ServiceUnavailable);
});

app.MapPost("/api/rescan", async (IMonitorControl control, MonitorState state, CancellationToken cancellationToken) =>
{
    await control.RequestRescanAsync(cancellationToken);
    return Results.Ok(state.GetStatus());
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
