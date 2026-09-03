import {
    Children,
    isValidElement,
    type ReactElement,
    type ReactNode,
} from "react";

import { normalizeYAxisId } from "./y-axis-scales";

export interface ReferenceAreaConfig {
    axisLabelColor?: string;
    y1?: number;
    y2?: number;
    yAxisId: string;
}

interface ReferenceAreaConfigProperties {
    axisLabelColor?: string;
    y1?: number;
    y2?: number;
    yAxisId?: number | string;
}

/** Collect {@link ReferenceArea} props from chart children for axis label styling. */
export function extractReferenceAreaConfigs(
    children: ReactNode
): ReferenceAreaConfig[] {
    const configs: ReferenceAreaConfig[] = [];

    const visit = (node: ReactNode) => {
        Children.forEach(node, (child) => {
            if (!isValidElement(child)) {
                return;
            }

            if (isReferenceAreaElement(child)) {
                const properties = child.props as
                    ReferenceAreaConfigProperties | undefined;
                if (properties) {
                    configs.push({
                        axisLabelColor: properties.axisLabelColor,
                        y1: properties.y1,
                        y2: properties.y2,
                        yAxisId: normalizeYAxisId(properties.yAxisId),
                    });
                }
                return;
            }

            const childProperties = child.props as
                undefined | { children?: ReactNode };
            if (childProperties?.children) {
                visit(childProperties.children);
            }
        });
    };

    visit(children);
    return configs;
}

function getChildComponentName(child: ReactElement) {
    const childType = child.type as { displayName?: string; name?: string };
    return typeof child.type === "function"
        ? childType.displayName || childType.name || ""
        : "";
}

function isReferenceAreaElement(child: ReactElement): boolean {
    return getChildComponentName(child) === "ReferenceArea";
}
