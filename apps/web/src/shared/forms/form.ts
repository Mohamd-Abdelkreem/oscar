import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type {
  FieldPath,
  FieldValues,
  UseFormProps,
  UseFormReturn,
  UseFormSetError,
} from "react-hook-form";
import type { ZodType } from "zod";

import { getApiError } from "@/services/api/api-client";

export const useZodForm = <
  TInput extends FieldValues,
  TOutput extends FieldValues,
>(
  schema: ZodType<TOutput, TInput>,
  options: Omit<UseFormProps<TInput, TInput, TOutput>, "resolver"> = {},
): UseFormReturn<TInput, TInput, TOutput> =>
  useForm<TInput, TInput, TOutput>({
    ...options,
    resolver: zodResolver(schema),
  });

type FormErrorTarget<TFields extends FieldValues> = Readonly<{
  getValues: () => TFields;
  setError: UseFormSetError<TFields>;
}>;

const isKnownField = <TFields extends FieldValues>(
  values: TFields,
  field: string,
): field is FieldPath<TFields> =>
  Object.prototype.hasOwnProperty.call(values, field);

export const applyApiFormError = <TFields extends FieldValues>(
  error: unknown,
  form: FormErrorTarget<TFields>,
): string => {
  const apiError = getApiError(error);
  for (const [rawField, messages] of Object.entries(apiError.fieldErrors)) {
    const field = rawField.replace(/^body\./u, "");
    const message = messages[0];
    if (!isKnownField(form.getValues(), field) || message === undefined)
      continue;
    form.setError(field, { type: "server", message });
  }
  return apiError.message;
};
