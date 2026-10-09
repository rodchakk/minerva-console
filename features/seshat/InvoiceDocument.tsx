import Image from "next/image";
import { Globe2, Landmark, Mail, Phone, WalletCards } from "lucide-react";
import {
  formatInvoiceDocumentAmount,
  formatInvoiceDocumentDate,
  invoiceDocumentCopy,
  paymentInstructionPresentation,
  type InvoiceDocumentLanguage,
} from "./invoicePresentation";
import type { BusinessProfile, InvoiceDetail } from "./types";

const MINERVA_CONTACT = {
  email: "support@minervatechs.com",
  phone: "+504 3220-9818",
  website: "www.minervatechs.com",
};

export function InvoiceDocument({
  invoice,
  profile,
  language,
}: {
  invoice: InvoiceDetail;
  profile: BusinessProfile | null;
  language: InvoiceDocumentLanguage;
}) {
  const copy = invoiceDocumentCopy[language];
  const balance = invoice.balance_due ?? Math.max(invoice.total - invoice.amount_paid, 0);
  const payment = invoice.payment_instruction_snapshot
    ? paymentInstructionPresentation(invoice.payment_instruction_snapshot, language)
    : null;
  const PaymentIcon = invoice.payment_instruction_snapshot?.method_type === "bank_transfer"
    ? Landmark
    : WalletCards;
  const clientName = invoice.clients?.company_name ?? invoice.clients?.name ?? "—";
  const clientDetail = invoice.clients?.company_name && invoice.clients.name !== invoice.clients.company_name
    ? invoice.clients.name
    : invoice.clients?.email;
  const amount = (value: number | null | undefined) =>
    formatInvoiceDocumentAmount(value, invoice.currency, language);

  return (
    <section
      data-seshat-invoice-document
      lang={language}
      aria-label={`${copy.invoice} ${invoice.invoice_number}`}
      className="mx-auto w-full max-w-[820px] overflow-hidden rounded-md border border-slate-200 bg-white px-6 py-7 text-slate-900 shadow-[0_18px_55px_rgba(15,23,42,0.18)] sm:px-10 sm:py-9"
    >
      <header className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Image
          src="/brand/minerva-logo-gray.png"
          alt={profile?.business_name ?? "Minerva Technologies"}
          width={260}
          height={87}
          className="h-auto w-[220px] max-w-full"
          priority
        />
        <address className="not-italic text-[11px] leading-5 text-slate-600 sm:text-xs">
          <ContactLine icon={Mail} value={MINERVA_CONTACT.email} />
          <ContactLine icon={Phone} value={MINERVA_CONTACT.phone} />
          <ContactLine icon={Globe2} value={MINERVA_CONTACT.website} />
        </address>
      </header>

      <div data-invoice-accent-rule className="mt-5 h-px bg-red-500" />

      <div className="grid gap-7 py-8 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,0.9fr)] sm:items-center">
        <div>
          <h1 className="text-4xl font-black uppercase leading-none text-slate-900 sm:text-5xl">
            {copy.invoice}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-lg font-bold text-slate-800">{invoice.invoice_number}</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
              {copy.statuses[invoice.status]}
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 gap-y-2 border-l border-slate-200 pl-5 text-xs sm:text-sm">
          <Metadata label={copy.issueDate} value={formatInvoiceDocumentDate(invoice.issue_date, language)} />
          <Metadata label={copy.dueDate} value={formatInvoiceDocumentDate(invoice.due_date, language)} />
          <Metadata label={copy.currency} value={invoice.currency} />
          {invoice.paid_date ? (
            <Metadata label={copy.paidDate} value={formatInvoiceDocumentDate(invoice.paid_date, language)} />
          ) : null}
        </dl>
      </div>

      <section data-invoice-bill-to className="rounded-md bg-slate-100 px-5 py-4">
        <p className="text-xs font-medium text-slate-500">{copy.billTo}</p>
        <p className="mt-1 text-base font-bold text-slate-900">{clientName}</p>
        {clientDetail ? <p className="mt-0.5 text-xs text-slate-600">{clientDetail}</p> : null}
      </section>

      <div className="mt-6 overflow-hidden rounded border border-slate-300">
        <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
          <thead className="bg-slate-100 text-[10px] uppercase text-slate-600 sm:text-[11px]">
            <tr>
              <th className="w-[51%] px-4 py-3 text-left font-semibold">{copy.item}</th>
              <th className="w-[11%] border-l border-slate-200 px-2 py-3 text-center font-semibold">{copy.quantity}</th>
              <th className="w-[19%] border-l border-slate-200 px-3 py-3 text-right font-semibold">{copy.unitPrice}</th>
              <th className="w-[19%] border-l border-slate-200 px-3 py-3 text-right font-semibold">{copy.total}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.invoice_items.map((item) => (
              <tr key={item.id} className="border-t border-slate-200 align-top">
                <td className="px-4 py-4">
                  <p className="font-bold leading-5 text-slate-900">{item.name}</p>
                  {item.description ? <p className="mt-1 leading-4 text-slate-500">{item.description}</p> : null}
                </td>
                <td className="border-l border-slate-200 px-2 py-4 text-center tabular-nums">{item.quantity}</td>
                <td className="border-l border-slate-200 px-3 py-4 text-right tabular-nums">{amount(item.unit_price)}</td>
                <td className="border-l border-slate-200 px-3 py-4 text-right tabular-nums">{amount(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl data-invoice-totals className="ml-auto mt-4 w-full max-w-[370px] text-xs sm:text-sm">
        <TotalRow label={copy.subtotal} value={amount(invoice.subtotal)} />
        {invoice.discount_total > 0 ? <TotalRow label={copy.discount} value={amount(-invoice.discount_total)} /> : null}
        {invoice.tax_total > 0 ? <TotalRow label={copy.tax} value={amount(invoice.tax_total)} /> : null}
        <TotalRow label={copy.totalPayable} value={amount(invoice.total)} highlighted />
        <TotalRow label={copy.paid} value={amount(invoice.amount_paid)} />
        <TotalRow label={copy.balanceDue} value={amount(balance)} balance />
      </dl>

      {payment ? (
        <section data-seshat-payment-information className="mt-7 grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4 rounded-md bg-slate-100 px-5 py-4">
          <div className="flex items-start justify-center border-r border-slate-300 pr-4 pt-1 text-slate-600">
            <PaymentIcon aria-hidden="true" className="h-7 w-7" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">{payment.heading}</h2>
            <p className="mt-0.5 text-xs font-medium text-slate-600">{payment.methodName}</p>
            {payment.rows.length > 0 ? (
              <dl className="mt-2 grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-4 gap-y-1 text-xs">
                {payment.rows.map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-slate-500">{row.label}</dt>
                    <dd className="min-w-0 break-words text-slate-800">
                      {row.isLink ? <a href={row.value} className="underline">{row.value}</a> : row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </section>
      ) : null}

      {invoice.notes ? <p className="mt-6 whitespace-pre-wrap text-xs leading-5 text-slate-600">{invoice.notes}</p> : null}

      <footer className="mt-8">
        <div data-invoice-accent-rule className="h-px bg-red-500" />
        <p className="mt-5 text-xs font-bold text-slate-800">Minerva Technologies</p>
        <p className="mt-1 text-[10px] leading-4 text-slate-500">{copy.footerTagline}</p>
      </footer>
    </section>
  );
}

function ContactLine({ icon: Icon, value }: { icon: typeof Mail; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-700" strokeWidth={2} />
      <span>{value}</span>
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function TotalRow({
  label,
  value,
  highlighted = false,
  balance = false,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
  balance?: boolean;
}) {
  return (
    <div
      className={[
        "grid grid-cols-[minmax(0,1fr)_auto] gap-5 px-3 py-2",
        highlighted ? "rounded bg-slate-100 font-bold text-slate-900" : "",
        balance ? "mt-1 border-t border-slate-300 pt-3 font-bold text-slate-900" : "",
      ].join(" ")}
    >
      <dt>{label}</dt>
      <dd className={balance ? "tabular-nums text-red-600" : "tabular-nums"}>{value}</dd>
    </div>
  );
}
