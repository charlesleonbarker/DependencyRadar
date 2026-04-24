namespace Depmap.Service.Services;

public interface IMonitorControl
{
    Task RequestRescanAsync(CancellationToken cancellationToken);
}
