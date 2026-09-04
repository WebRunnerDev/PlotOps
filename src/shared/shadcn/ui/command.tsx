import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { CheckIcon, SearchIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import {
    InputGroup,
    InputGroupAddon,
} from "@/shared/shadcn/ui/input-group";

function Command({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
    return (
        <CommandPrimitive
            className={cn(
                "flex size-full flex-col overflow-hidden rounded-none! bg-popover p-1 text-popover-foreground",
                className
            )}
            data-slot="command"
            {...props}
        />
    );
}

function CommandDialog({
    title = "Command Palette",
    description = "Search for a command to run...",
    children,
    className,
    showCloseButton = false,
    ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
    children: React.ReactNode;
    className?: string;
    description?: string;
    showCloseButton?: boolean;
    title?: string;
}) {
    return (
        <Dialog {...props}>
            <DialogContent
                className={cn(
                    "top-1/3 translate-y-0 overflow-hidden rounded-none! border-border p-0 ring-1 ring-primary/25 sm:max-w-lg",
                    className
                )}
                showCloseButton={showCloseButton}
            >
                <DialogHeader className="sr-only">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}

function CommandInput({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
    return (
        <div className="p-1 pb-0" data-slot="command-input-wrapper">
            <InputGroup className="h-8! rounded-none! border-primary/25 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!">
                <CommandPrimitive.Input
                    className={cn(
                        "w-full font-mono text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
                        className
                    )}
                    data-slot="command-input"
                    {...props}
                />
                <InputGroupAddon>
                    <SearchIcon className="size-4 shrink-0 text-primary/70" />
                </InputGroupAddon>
            </InputGroup>
        </div>
    );
}

function CommandList({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
    return (
        <CommandPrimitive.List
            className={cn(
                "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto outline-none",
                className
            )}
            data-slot="command-list"
            {...props}
        />
    );
}

function CommandEmpty({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
    return (
        <CommandPrimitive.Empty
            className={cn(
                "flex flex-col items-center gap-2 px-4 py-10 text-center",
                className
            )}
            data-slot="command-empty"
            {...props}
        />
    );
}

function CommandGroup({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
    return (
        <CommandPrimitive.Group
            className={cn(
                "overflow-hidden p-1 text-foreground **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:font-mono **:[[cmdk-group-heading]]:text-meta **:[[cmdk-group-heading]]:text-muted-foreground",
                className
            )}
            data-slot="command-group"
            {...props}
        />
    );
}

function CommandSeparator({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
    return (
        <CommandPrimitive.Separator
            className={cn("-mx-1 h-px bg-primary/20", className)}
            data-slot="command-separator"
            {...props}
        />
    );
}

function CommandItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
    return (
        <CommandPrimitive.Item
            className={cn(
                "group/command-item relative flex cursor-default items-center gap-2 rounded-none px-2 py-1.5 text-sm outline-hidden select-none transition-colors duration-150 ease-[var(--ease-out-quart)] in-data-[slot=dialog-content]:rounded-none!",
                "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
                "data-selected:bg-primary/12 data-selected:text-foreground",
                "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:*:[svg]:text-primary",
                className
            )}
            data-slot="command-item"
            {...props}
        >
            {children}
            <CheckIcon className="ml-auto text-primary opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
        </CommandPrimitive.Item>
    );
}

function CommandShortcut({
    className,
    ...props
}: React.ComponentProps<"span">) {
    return (
        <span
            className={cn(
                "ml-auto text-xs tracking-widest text-muted-foreground group-data-selected/command-item:text-foreground",
                className
            )}
            data-slot="command-shortcut"
            {...props}
        />
    );
}

export {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
};
