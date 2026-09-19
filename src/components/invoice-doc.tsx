import { Button } from "@/components/ui/button";
import { money, shortDate } from "@/lib/housefile/format";
import {
  companyPlace,
  companyWebsiteHref,
  companyWebsiteLabel,
  invoiceDateIso,
  invoiceDueLabel,
  invoiceLines,
  invoiceNumber,
  invoicePaymentCopy,
  invoiceThankYou,
  invoiceTotal,
} from "@/lib/housefile/invoice";
import { normalizePaymentLink } from "@/lib/housefile/payment";
import { lineShowsQuantity } from "@/lib/housefile/estimate-lines";
import { invoiceSalesReps, type InvoiceView } from "@/lib/housefile/invoice";

export function InvoiceDoc({ bundle }: { bundle: InvoiceView }) {
  const { proposal, items, property, company } = bundle;
  const reps = invoiceSalesReps(bundle);
  const lines = invoiceLines(items);
  const total = invoiceTotal(items);
  const invoiceNo = invoiceNumber(proposal);
  const issued = invoiceDateIso(proposal);
  const due = invoiceDueLabel(company.payment_terms);
  const place = companyPlace(company);
  const websiteHref = companyWebsiteHref(company.website);
  const websiteLabel = companyWebsiteLabel(company.website);
  const portal = normalizePaymentLink(proposal.payment_link || company.payment_link);
  const mailTo = [company.name, ...place].filter(Boolean);

  return (
    <article className="space-y-6 bg-card p-5 text-card-foreground shadow-[var(--shadow-border)] sm:p-8">
      <header className="space-y-2 border-b border-border pb-4 text-center">
        <p className="font-display text-3xl font-semibold tracking-tight">{company.name}</p>
        <p className="text-sm text-muted-foreground">Quality and Service</p>
        {place.map((line) => (
          <p key={line} className="text-sm text-muted-foreground">
            {line}
          </p>
        ))}
        {company.phone ? <p className="text-sm text-muted-foreground">{company.phone}</p> : null}
        {websiteHref ? (
          <p className="text-sm">
            <a className="underline underline-offset-4" href={websiteHref} rel="noreferrer">
              {websiteLabel}
            </a>
          </p>
        ) : null}
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Licensed and Insured</p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-medium tracking-tight">Invoice/Receipt</h1>
        <p className="text-sm text-muted-foreground">#{invoiceNo}</p>
      </div>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="font-medium">{company.name}</p>
          {place.map((line) => (
            <p key={`shop-${line}`} className="text-sm text-muted-foreground">
              {line}
            </p>
          ))}
          {company.phone ? <p className="text-sm text-muted-foreground">{company.phone}</p> : null}
        </div>
        {reps.length ? (
          <div className="space-y-3 sm:text-right">
            {reps.map((rep) => (
              <div key={rep.email || rep.name} className="space-y-1">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">
                  {reps.length > 1 ? "Sales Representative" : "Sales Representative"}
                </p>
                <p className="font-medium">{rep.name}</p>
                {rep.email ? (
                  <p className="text-sm text-muted-foreground">
                    <a className="underline underline-offset-4" href={`mailto:${rep.email}`}>
                      {rep.email}
                    </a>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 border-y border-border py-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Billing</p>
          <p className="font-medium">{property.homeowner_name}</p>
          <p className="text-sm text-muted-foreground">
            {property.address_line}
            <br />
            {property.city}, {property.state} {property.zip}
          </p>
          {property.homeowner_phone ? (
            <p className="text-sm text-muted-foreground">{property.homeowner_phone}</p>
          ) : null}
          {property.homeowner_email ? (
            <p className="text-sm text-muted-foreground">{property.homeowner_email}</p>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:text-right">
          <dt className="text-muted-foreground">Invoice #</dt>
          <dd className="font-medium tabular-nums">{invoiceNo}</dd>
          <dt className="text-muted-foreground">Date</dt>
          <dd className="tabular-nums">{shortDate(issued)}</dd>
          <dt className="text-muted-foreground">Amount Due</dt>
          <dd className="font-medium tabular-nums">{money(total)}</dd>
          <dt className="text-muted-foreground">Due Date</dt>
          <dd>{due}</dd>
        </dl>
      </section>

      <section className="space-y-2">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Product/Service</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-80 border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium">Item</th>
                <th className="py-2 pr-3 font-medium">Description</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-4 text-muted-foreground">
                    No billed lines on this invoice.
                  </td>
                </tr>
              ) : (
                lines.map((item) => (
                  <tr key={item.id} className="border-b border-border align-top">
                    <td className="py-3 pr-3 font-medium">{item.name}</td>
                    <td className="py-3 pr-3 text-muted-foreground">
                      {item.description || "—"}
                      {lineShowsQuantity(item.name) ? (
                        <span className="mt-1 block text-xs">
                          {item.qty} {item.unit}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 text-right tabular-nums">{money(item.qty * item.unit_price)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {invoicePaymentCopy({
            companyName: company.name,
            paymentTerms: company.payment_terms,
            invoiceNo,
            hasPortal: Boolean(portal),
          })}
        </p>
        <p className="text-sm">{invoiceThankYou(reps)}</p>
        {portal ? (
          <Button asChild className="min-h-12 w-full sm:w-auto">
            <a href={portal} target="_blank" rel="noreferrer">
              Payment Portal
            </a>
          </Button>
        ) : null}
      </section>

      <dl className="ml-auto grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Sub Total</dt>
        <dd className="text-right tabular-nums">{money(total)}</dd>
        <dt className="text-muted-foreground">Total</dt>
        <dd className="text-right font-medium tabular-nums">{money(total)}</dd>
        <dt className="text-muted-foreground">Amount Paid</dt>
        <dd className="text-right tabular-nums">{money(0)}</dd>
        <dt className="font-medium">Balance Due</dt>
        <dd className="text-right font-medium tabular-nums">{money(total)}</dd>
      </dl>

      <section className="space-y-1 border-t border-border pt-4">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Special Instructions</p>
        {mailTo.length ? (
          <>
            <p className="text-sm text-muted-foreground">Mail checks to:</p>
            {mailTo.map((line) => (
              <p key={`mail-${line}`} className="text-sm">
                {line}
              </p>
            ))}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Ask the shop where to mail checks.</p>
        )}
        {company.terms ? (
          <p className="whitespace-pre-wrap pt-2 text-sm leading-relaxed text-muted-foreground">{company.terms}</p>
        ) : null}
      </section>
    </article>
  );
}
