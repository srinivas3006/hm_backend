# Analytics Sequence

```mermaid
sequenceDiagram
  EventBus->>AnalyticsSubscriber: domain event
  AnalyticsSubscriber->>AnalyticsService: record projection
  AnalyticsService->>AnalyticsRepository: aggregate metrics
  Admin->>AdminAnalyticsController: dashboard/report
```
