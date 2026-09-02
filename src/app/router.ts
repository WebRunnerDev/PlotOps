import { QueryClient } from "@tanstack/react-query";

import { createAppRouter } from "./create-app-router";

export const queryClient = new QueryClient();

export const router = createAppRouter(queryClient);
