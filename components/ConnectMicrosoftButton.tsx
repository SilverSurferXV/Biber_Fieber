import * as React from "react";
import { Button } from "./Button";

type Feature = "mail" | "calendar" | "drive";

type Props = {
  feature: Feature | Feature[];
  onConnected?: () => void;
};

export function ConnectMicrosoftButton({ feature, onConnected }: Props) {
  const openFlow = () => {
    const popup = window.open("about:blank", "microsoft_integrations", "width=480,height=720");
    if (!popup) return;

    const listener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.type === "MICROSOFT_INTEGRATION_SUCCESS") {
        window.removeEventListener("message", listener);
        onConnected?.();
      } else if (data?.type === "MICROSOFT_INTEGRATION_ERROR") {
        window.removeEventListener("message", listener);
      }
    };
    window.addEventListener("message", listener);

    const features = Array.isArray(feature) ? feature : [feature];
    fetch(`/_api/auth/microsoft_integrations_authorize?feature=${encodeURIComponent(features.join(","))}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.authorize_url) throw new Error("start_failed");
        popup.location.href = data.authorize_url;
      })
      .catch(() => {
        window.removeEventListener("message", listener);
        popup.close();
      });
  };

  return (
    <Button type="button" onClick={openFlow}>
      Connect Microsoft
    </Button>
  );
}
