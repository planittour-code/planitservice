import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fieldVisible, type TakeoffField, type WorkType } from "@/lib/housefile/quote";

export function TakeoffInput({
  field,
  value,
  onChange,
  allowEmpty = false,
  idPrefix = "to",
}: {
  field: TakeoffField;
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
  idPrefix?: string;
}) {
  const id = `${idPrefix}-${field.key}`;
  if (field.kind === "toggle") {
    const on = value === "yes" || value === "true" || value === "1";
    return (
      <label className="flex min-h-9 items-center gap-3 rounded-lg bg-background px-3 py-2 shadow-[var(--shadow-border)] sm:col-span-2">
        <input
          id={id}
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked ? "yes" : "no")}
          className="size-4"
        />
        <span>
          <span className="block text-sm font-medium">{field.label}</span>
          <span className="block text-xs text-muted-foreground">{field.hint}</span>
        </span>
      </label>
    );
  }
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {field.label}
        {field.unit ? ` (${field.unit})` : ""}
        {field.required ? " *" : ""}
      </Label>
      {field.kind === "select" ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className="flex h-9 w-full rounded-md bg-background px-2.5 text-sm shadow-[var(--shadow-border)] outline-none"
        >
          {allowEmpty ? <option value="">Select</option> : null}
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={id}
          type={field.kind === "number" ? "number" : "text"}
          inputMode={field.kind === "number" ? "decimal" : "text"}
          step={field.kind === "number" ? "any" : undefined}
          min={field.kind === "number" ? 0 : undefined}
          placeholder={field.placeholder}
          value={value}
          required={field.required}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.hint ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}
    </div>
  );
}

export function TakeoffFields({
  work,
  inputs,
  onChange,
  notes,
  onNotes,
  allowEmpty = false,
  idPrefix = "lead",
}: {
  work: WorkType;
  inputs: Record<string, string>;
  onChange: (key: string, value: string) => void;
  notes?: string;
  onNotes?: (value: string) => void;
  allowEmpty?: boolean;
  idPrefix?: string;
}) {
  const fields = work.fields.filter((field) => fieldVisible(field, inputs));
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <TakeoffInput
          key={field.key}
          field={field}
          value={inputs[field.key] ?? ""}
          onChange={(v) => onChange(field.key, v)}
          allowEmpty={allowEmpty}
          idPrefix={idPrefix}
        />
      ))}
      {onNotes ? (
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor={`${idPrefix}-notes`}>Anything else for the quote</Label>
          <Textarea
            id={`${idPrefix}-notes`}
            value={notes ?? ""}
            onChange={(e) => onNotes(e.target.value)}
            placeholder="Access, colors you already bought, rooms to skip, timing"
            rows={3}
          />
        </div>
      ) : null}
    </div>
  );
}
