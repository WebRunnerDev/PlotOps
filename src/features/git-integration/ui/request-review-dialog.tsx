import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { GitHubReviewer } from "@/features/git-integration/api/github-git-api";

import {
    normalizeReviewerLogin,
    reviewerLoginStatus,
    sameLogin,
} from "@/features/git-integration/lib/reviewer-selection";
import { usePullRequestReviewerCandidates } from "@/features/git-integration/model/use-git-data";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
import { Button } from "@/shared/shadcn/ui/button";
import { Checkbox } from "@/shared/shadcn/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/shadcn/ui/dialog";
import { Input } from "@/shared/shadcn/ui/input";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type RequestReviewDialogProperties = {
    onClose: () => void;
    onSubmit: (reviewers: string[]) => void;
    open: boolean;
    /** True while the request is in flight — locks the dialog. */
    pending: boolean;
    prNumber: number;
    repoFullName: string;
    token: null | string;
};

export function RequestReviewDialog({
    onClose,
    onSubmit,
    open,
    pending,
    prNumber,
    repoFullName,
    token,
}: RequestReviewDialogProperties) {
    const { t } = useTranslation("board");
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<string[]>([]);
    /** Logins typed by hand that the collaborator list does not contain. */
    const [typedReviewers, setTypedReviewers] = useState<GitHubReviewer[]>([]);
    const [inputError, setInputError] = useState<string | undefined>();

    const { data, isError, isLoading } = usePullRequestReviewerCandidates(
        repoFullName,
        prNumber,
        token,
        open
    );
    const authorLogin = data?.authorLogin ?? null;
    const requestedLogins = data?.requestedLogins ?? [];

    const reviewers = [
        ...typedReviewers,
        ...(data?.candidates ?? []).filter(
            (candidate) =>
                !authorLogin || !sameLogin(candidate.login, authorLogin)
        ),
    ];
    const needle = query.trim().replace(/^@/, "").toLowerCase();
    const visibleReviewers = needle
        ? reviewers.filter((reviewer) =>
              reviewer.login.toLowerCase().includes(needle)
          )
        : reviewers;
    const typedLogin = normalizeReviewerLogin(query);
    const typedMatch = typedLogin
        ? reviewers.find((reviewer) => sameLogin(reviewer.login, typedLogin))
        : undefined;

    const isRequested = (login: string) =>
        requestedLogins.some((requested) => sameLogin(requested, login));
    const isSelected = (login: string) =>
        selected.some((entry) => sameLogin(entry, login));

    const toggle = (login: string) => {
        if (pending || isRequested(login)) return;
        setInputError(undefined);
        setSelected((current) =>
            current.some((entry) => sameLogin(entry, login))
                ? current.filter((entry) => !sameLogin(entry, login))
                : [...current, login]
        );
    };

    const handleAddTyped = () => {
        if (pending || !query.trim()) return;
        if (typedMatch) {
            if (isRequested(typedMatch.login)) {
                setInputError(
                    t("github.requestReviewAlreadyRequested", {
                        login: typedMatch.login,
                    })
                );
                return;
            }
            if (!isSelected(typedMatch.login)) toggle(typedMatch.login);
            setQuery("");
            return;
        }

        const status = reviewerLoginStatus({
            authorLogin,
            login: query,
            requestedLogins,
        });
        switch (status) {
            case "already_requested": {
                setInputError(
                    t("github.requestReviewAlreadyRequested", {
                        login: typedLogin,
                    })
                );
                return;
            }
            case "author": {
                setInputError(t("github.requestReviewError.author"));
                return;
            }
            case "invalid": {
                setInputError(t("github.requestReviewInvalidLogin"));
                return;
            }
            case "ok": {
                if (!typedLogin) return;
                setTypedReviewers((current) => [
                    { avatar_url: null, login: typedLogin },
                    ...current,
                ]);
                setSelected((current) => [...current, typedLogin]);
                setInputError(undefined);
                setQuery("");
            }
        }
    };

    return (
        <Dialog
            onOpenChange={(next) => {
                if (!next && !pending) onClose();
            }}
            open={open}
        >
            <DialogContent showCloseButton={!pending}>
                <DialogHeader>
                    <DialogTitle>
                        {t("github.requestReviewTitle", { number: prNumber })}
                    </DialogTitle>
                    <DialogDescription>
                        {t("github.requestReviewBody")}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <Input
                            aria-invalid={inputError ? true : undefined}
                            aria-label={t("github.requestReviewSearch")}
                            autoFocus
                            className="min-w-0 font-mono text-code"
                            disabled={pending}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setInputError(undefined);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleAddTyped();
                                }
                            }}
                            placeholder={t("github.requestReviewSearch")}
                            value={query}
                        />
                        <Button
                            aria-label={t("github.requestReviewAdd")}
                            disabled={pending || !query.trim()}
                            onClick={handleAddTyped}
                            size="icon-sm"
                            title={t("github.requestReviewAdd")}
                            type="button"
                            variant="outline"
                        >
                            <UserPlus />
                        </Button>
                    </div>
                    {inputError ? (
                        <p className="text-meta text-destructive" role="alert">
                            {inputError}
                        </p>
                    ) : undefined}

                    {isLoading ? (
                        <p className="inline-flex items-center gap-2 text-ui text-muted-foreground">
                            <Spinner className="size-3.5" />
                            {t("github.requestReviewLoading")}
                        </p>
                    ) : undefined}
                    {isError ? (
                        <p className="text-ui text-muted-foreground">
                            {t("github.requestReviewLoadFailed")}
                        </p>
                    ) : undefined}
                    {data?.listUnavailable ? (
                        <p className="text-ui text-muted-foreground">
                            {t("github.requestReviewListUnavailable")}
                        </p>
                    ) : undefined}

                    {visibleReviewers.length > 0 ? (
                        <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
                            {visibleReviewers.map((reviewer) => {
                                const requested = isRequested(reviewer.login);
                                return (
                                    <li key={reviewer.login.toLowerCase()}>
                                        <label
                                            className={cn(
                                                "flex min-w-0 items-center gap-2 px-1.5 py-1.5 text-ui",
                                                requested || pending
                                                    ? "cursor-not-allowed opacity-60"
                                                    : "cursor-pointer hover:bg-muted/60"
                                            )}
                                        >
                                            <Checkbox
                                                checked={
                                                    requested ||
                                                    isSelected(reviewer.login)
                                                }
                                                disabled={requested || pending}
                                                onCheckedChange={() =>
                                                    toggle(reviewer.login)
                                                }
                                            />
                                            <Avatar size="sm">
                                                {reviewer.avatar_url ? (
                                                    <AvatarImage
                                                        alt=""
                                                        src={
                                                            reviewer.avatar_url
                                                        }
                                                    />
                                                ) : undefined}
                                                <AvatarFallback>
                                                    {reviewer.login
                                                        .slice(0, 1)
                                                        .toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="min-w-0 flex-1 truncate font-mono text-code">
                                                {reviewer.login}
                                            </span>
                                            {requested ? (
                                                <span className="shrink-0 text-meta text-muted-foreground">
                                                    {t(
                                                        "github.requestReviewRequested"
                                                    )}
                                                </span>
                                            ) : undefined}
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : isLoading ? undefined : (
                        <p className="text-ui text-muted-foreground">
                            {t("github.requestReviewEmpty")}
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        disabled={pending}
                        onClick={onClose}
                        type="button"
                        variant="outline"
                    >
                        {t("github.requestReviewCancel")}
                    </Button>
                    <Button
                        disabled={pending || selected.length === 0}
                        onClick={() => onSubmit(selected)}
                        type="button"
                    >
                        {pending ? <Spinner className="size-3.5" /> : undefined}
                        {t("github.requestReviewConfirm")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
