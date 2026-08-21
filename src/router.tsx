import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { NotFound } from "@/components/not-found";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const basepath = import.meta.env.BASE_URL.replace(/\/$/, "");
  return createRouter({
    routeTree,
    basepath: basepath && basepath !== "/" ? basepath : undefined,
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  });
}
