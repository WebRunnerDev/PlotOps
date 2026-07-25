import { createFileRoute } from "@tanstack/react-router";

import { CiCdPage } from "@/features/ci-cd";

export const Route = createFileRoute("/(main)/projects/$projectId/ci-cd")({
    component: ProjectCiCdRoute,
});

function ProjectCiCdRoute() {
    const { projectId } = Route.useParams();
    return <CiCdPage projectId={projectId} />;
}
