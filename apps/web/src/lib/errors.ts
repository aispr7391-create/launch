import { BaseError, UserRejectedRequestError } from "viem";

/** Turn wallet / RPC errors into one short, human sentence. */
export function readableError(err: unknown): string {
  if (!err) return "";
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return "Request rejected in your wallet.";
    return err.shortMessage || err.message;
  }
  if (err instanceof Error) {
    if (/rejected|denied/i.test(err.message)) return "Request rejected in your wallet.";
    return err.message.split("\n")[0];
  }
  return "Something went wrong.";
}
