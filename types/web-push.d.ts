declare module "web-push" {
  export type PushSubscription = {
    endpoint: string;
    keys: {
      auth: string;
      p256dh: string;
    };
  };

  export type SendResult = {
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
    body: string;
  };

  export type WebPushError = Error & {
    statusCode?: number;
    headers?: Record<string, string | string[] | undefined>;
    body?: string;
    endpoint?: string;
  };

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string,
  ): void;

  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: {
      TTL?: number;
      urgency?: "very-low" | "low" | "normal" | "high";
      topic?: string;
    },
  ): Promise<SendResult>;

  const webpush: {
    setVapidDetails: typeof setVapidDetails;
    sendNotification: typeof sendNotification;
  };

  export default webpush;
}
