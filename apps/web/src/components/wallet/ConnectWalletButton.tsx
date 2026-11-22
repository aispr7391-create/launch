"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import { ConnectModal } from "./ConnectModal";
import { AccountMenu } from "./AccountMenu";

export function ConnectWalletButton({ block = false }: { block?: boolean }) {
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close the modal once a connection succeeds.
  useEffect(() => {
    if (isConnected) setOpen(false);
  }, [isConnected]);

  if (mounted && isConnected) return <AccountMenu />;

  return (
    <>
      <Button
        variant="primary"
        onClick={() => setOpen(true)}
        disabled={!mounted || isReconnecting}
        className={block ? "w-full" : undefined}
      >
        <Icon name="wallet" />
        {isConnecting || isReconnecting ? "Connecting…" : "Connect wallet"}
      </Button>
      {open && <ConnectModal onClose={() => setOpen(false)} />}
    </>
  );
}
