import type { CustomFieldsProvider } from "@/features/custom-fields/api/custom-fields-provider";

import {
    copyProjectCustomField,
    createProjectCustomField,
    deleteProjectCustomField,
    fetchProjectCustomFields,
    fetchProjectCustomFieldValueUsage,
    fetchTaskCustomFieldValues,
    reorderProjectCustomFields,
    updateProjectCustomField,
    upsertTaskCustomFieldValue,
} from "@/features/custom-fields/api/custom-fields-api";

/** Real-account custom fields adapter — delegates to Supabase APIs. */
export const supabaseCustomFieldsProvider: CustomFieldsProvider = {
    copyProjectCustomField,
    createProjectCustomField,
    deleteProjectCustomField,
    fetchProjectCustomFields,
    fetchProjectCustomFieldValueUsage,
    fetchTaskCustomFieldValues,
    reorderProjectCustomFields,
    updateProjectCustomField,
    upsertTaskCustomFieldValue,
};
