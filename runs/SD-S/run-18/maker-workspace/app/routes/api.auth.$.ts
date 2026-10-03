import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { handleAuthRequest } from "~/auth/auth.server";

export async function loader({ request }: LoaderFunctionArgs) {
  return handleAuthRequest(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return handleAuthRequest(request);
}
