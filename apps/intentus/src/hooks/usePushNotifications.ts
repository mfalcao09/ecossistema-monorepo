import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// VAPID public key — generate pair via: npx web-push generate-vapid-keys
// Store private key in Supabase Edge Function secrets (VAPID_PRIVATE_KEY)
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

type PushPermissionState = "prompt" | "granted" | "denied" | "unsupported";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { userId, tenantId } = useAuth();
  const [permission, setPermission] = useState<PushPermissionState>("prompt");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !!VAPID_PUBLIC_KEY;

    setIsSupported(supported);

    if (!supported) {
      setPermission("unsupported");
      return;
    }

    // Check current permission
    setPermission(Notification.permission as PushPermissionState);

    // Check existing subscription
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setSubscription(sub);
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported || !userId) return false;
    setIsSubscribing(true);

    try {
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result as PushPermissionState);

      if (result !== "granted") {
        setIsSubscribing(false);
        return false;
      }

      // Get SW registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      setSubscription(sub);

      // Save subscription to Supabase
      const subJson = sub.toJSON();
      const { error } = await supabase.from("push_subscriptions" as any).upsert(
        {
          user_id: userId,
          tenant_id: tenantId,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh || "",
          auth: subJson.keys?.auth || "",
          user_agent: navigator.userAgent,
          created_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

      if (error) {
        console.warn("[Push] Failed to save subscription:", error);
      } else {
        console.log("[Push] Subscription saved");
      }

      setIsSubscribing(false);
      return true;
    } catch (err) {
      console.error("[Push] Subscribe error:", err);
      setIsSubscribing(false);
      return false;
    }
  }, [isSupported, userId, tenantId]);

  const unsubscribe = useCallback(async () => {
    if (!subscription) return;

    try {
      await subscription.unsubscribe();

      // Remove from Supabase
      const subJson = subscription.toJSON();
      await supabase
        .from("push_subscriptions" as any)
        .delete()
        .eq("endpoint", subJson.endpoint);

      setSubscription(null);
      console.log("[Push] Unsubscribed");
    } catch (err) {
      console.error("[Push] Unsubscribe error:", err);
    }
  }, [subscription]);

  return {
    isSupported,
    permission,
    subscription,
    isSubscribed: !!subscription,
    isSubscribing,
    subscribe,
    unsubscribe,
  };
}
