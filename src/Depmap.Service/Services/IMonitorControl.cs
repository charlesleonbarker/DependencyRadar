namespace DependencyRadar.Service.Services;

public interface IMonitorControl
{
    Task RequestRescanAsync(CancellationToken cancellationToken);
}
