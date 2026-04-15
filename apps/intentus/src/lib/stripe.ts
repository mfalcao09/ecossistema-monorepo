import { loadStripe } from "@stripe/stripe-js";

const FALLBACK_KEY =
  "pk_test_51T2XP1Icoggni2hDacen3N77kaWpozk77YWLqP8ULCieCtggwWIT8SM5A9bpSv0GV62xV2XePxd3xRpBrPuSkCmC00iza9wRLe";

export const STRIPE_PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || FALLBACK_KEY;

export const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
