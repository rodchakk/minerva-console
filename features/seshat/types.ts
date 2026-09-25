export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type ClientStatus = "lead" | "active" | "paused" | "inactive" | "archived";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";
export type ExpenseFrequency = "weekly" | "monthly" | "quarterly" | "yearly" | "one_time";
export type ServiceFrequency =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "yearly"
  | "one_time";

export type BusinessProfile = {
  id: string;
  owner_id: string;
  business_name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  logo_url: string | null;
  invoice_accent_color: string | null;
  invoice_footer: string | null;
  default_currency: string;
  default_payment_terms_days: number;
  invoice_prefix: string;
  next_invoice_number: number;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  owner_id: string;
  name: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  status: ClientStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  default_price: number;
  default_quantity: number;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientService = {
  id: string;
  owner_id: string;
  client_id: string;
  service_id: string | null;
  name: string;
  description: string | null;
  price: number;
  quantity: number;
  frequency: ServiceFrequency;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  auto_invoice: boolean;
  auto_invoice_start_date: string | null;
  notes: string | null;
  monthly_revenue: number | null;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  owner_id: string;
  client_id: string | null;
  invoice_number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  paid_date: string | null;
  currency: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  balance_due: number | null;
  notes: string | null;
  internal_notes: string | null;
  pdf_url: string | null;
  source_system: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  external_reference: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  auto_generated: boolean;
  created_at: string;
  updated_at: string;
};

export type InvoiceItem = {
  id: string;
  owner_id: string;
  invoice_id: string;
  service_id: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  line_total: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  owner_id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  proof_path: string | null;
  source_system: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  external_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  owner_id: string;
  category_id: string | null;
  client_id: string | null;
  name: string;
  vendor: string | null;
  amount: number;
  currency: string;
  frequency: ExpenseFrequency;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  receipt_url: string | null;
  monthly_amount: number | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseCategory = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
};

export type MonthlyProfitSummary = {
  owner_id: string;
  month: string;
  invoiced_total: number;
  paid_total: number;
  estimated_expenses: number;
  estimated_profit: number;
  profit_margin_percent: number;
};

export type ClientOperationalProfitSummary = {
  owner_id: string;
  client_id: string;
  client_name: string;
  status: string;
  active_monthly_revenue: number;
  allocated_monthly_expenses: number;
  estimated_monthly_profit: number;
  estimated_margin_percent: number;
  active_service_count: number;
  allocated_expense_count: number;
};

export type InvoiceWithClient = Invoice & {
  clients: { name: string; company_name: string | null; email: string | null } | null;
};

export type InvoiceDetail = InvoiceWithClient & {
  invoice_items: InvoiceItem[];
  payments: Payment[];
};

export type ExpenseWithCategory = Expense & {
  expense_categories: { name: string; color: string | null } | null;
};

export type GenerateInvoiceResult = {
  invoice_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  total: number;
  amount_paid: number;
  balance_due: number | null;
  created: boolean;
};

export type RecordPaymentResult = {
  payment_id: string;
  invoice_id: string;
  invoice_status: InvoiceStatus;
  amount_paid: number;
  balance_due: number | null;
  created: boolean;
};

export type DueClientServiceOccurrence = {
  client_service_id: string;
  client_id: string;
  client_name: string;
  service_id: string | null;
  service_name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
  frequency: ServiceFrequency;
  occurrence_date: string;
  billing_period_start: string;
  billing_period_end: string;
  external_reference: string;
};

export type AutomaticBillingRunResult = {
  as_of_date: string;
  due_count: number;
  created_count: number;
  existing_count: number;
  created_total: number;
};

export type Database = {
  public: {
    Tables: {
      business_profiles: { Row: BusinessProfile; Insert: Partial<BusinessProfile>; Update: Partial<BusinessProfile> };
      clients: { Row: Client; Insert: Partial<Client>; Update: Partial<Client> };
      services: { Row: Service; Insert: Partial<Service>; Update: Partial<Service> };
      client_services: { Row: ClientService; Insert: Partial<ClientService>; Update: Partial<ClientService> };
      invoices: { Row: Invoice; Insert: Partial<Invoice>; Update: Partial<Invoice> };
      invoice_items: { Row: InvoiceItem; Insert: Partial<InvoiceItem>; Update: Partial<InvoiceItem> };
      payments: { Row: Payment; Insert: Partial<Payment>; Update: Partial<Payment> };
      expenses: { Row: Expense; Insert: Partial<Expense>; Update: Partial<Expense> };
      expense_categories: { Row: ExpenseCategory; Insert: Partial<ExpenseCategory>; Update: Partial<ExpenseCategory> };
      monthly_profit_summary: { Row: MonthlyProfitSummary; Insert: never; Update: never };
      client_operational_profit_summary: { Row: ClientOperationalProfitSummary; Insert: never; Update: never };
    };
    Functions: {
      generate_invoice: {
        Args: {
          p_client_id?: string | null;
          p_status?: "draft" | "sent";
          p_issue_date?: string | null;
          p_due_date?: string | null;
          p_currency?: string | null;
          p_billing_period_start?: string | null;
          p_billing_period_end?: string | null;
          p_source_system?: string;
          p_source_entity_type?: string | null;
          p_source_entity_id?: string | null;
          p_external_reference?: string | null;
          p_auto_generated?: boolean;
          p_notes?: string | null;
          p_internal_notes?: string | null;
          p_items?: Json;
        };
        Returns: GenerateInvoiceResult[];
      };
      record_payment: {
        Args: {
          p_invoice_id: string;
          p_amount: number;
          p_payment_date?: string | null;
          p_payment_method?: string | null;
          p_reference?: string | null;
          p_notes?: string | null;
          p_source_system?: string;
          p_source_entity_type?: string | null;
          p_source_entity_id?: string | null;
          p_external_reference?: string | null;
        };
        Returns: RecordPaymentResult[];
      };
      refresh_overdue_invoices: { Args: { as_of_date?: string }; Returns: number };
      get_due_client_service_occurrences: {
        Args: { p_as_of_date?: string; p_client_id?: string | null; p_client_service_ids?: string[] | null };
        Returns: DueClientServiceOccurrence[];
      };
      run_client_service_billing: {
        Args: { p_as_of_date?: string; p_client_id?: string | null; p_client_service_ids?: string[] | null };
        Returns: AutomaticBillingRunResult[];
      };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
  };
};
