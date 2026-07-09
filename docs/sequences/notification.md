# Notification Sequence

```mermaid
sequenceDiagram
  EventBus->>NotificationSubscriber: domain event
  NotificationSubscriber->>NotificationService: create notification
  NotificationService->>NotificationRepository: persist status
  NotificationService->>ChannelAdapter: send or stub
```
