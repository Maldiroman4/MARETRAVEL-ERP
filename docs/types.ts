/**
 * MARETRAVEL ERP - Interfaces y Tipos TypeScript
 * Definiciones de dominio, DTOs de entrada y respuestas de API
 */

export type Currency = 'BOB' | 'USD';
export type RelationType = 'CLIENTE' | 'PROVEEDOR' | 'AMBOS';
export type AccountCategory = 'EMPRESA' | 'PERSONA' | 'AEROLINEA' | 'HOTEL' | 'ONG' | 'INSTITUCION' | 'RENT_A_CAR';
export type AccountRating = 'NORMAL' | 'IMPORTANTE' | 'VIP' | 'CRITICA';
export type BankAccountType = 'CORRIENTE' | 'AHORROS' | 'FONDO_ROTATORIO';
export type PaymentTerm = 'AL_CONTADO' | 'CREDITO_7_DIAS' | 'CREDITO_15_DIAS' | 'CREDITO_30_DIAS';
export type DebitNoteStatus = 'BORRADOR' | 'IMPAGA' | 'PARCIAL' | 'PAGADA' | 'ANULADA';
export type TicketStatus = 'DISPONIBLE' | 'ASIGNADO' | 'ANULADO' | 'REEMBOLSADO';
export type ServiceType = 'BOLETO_GDS' | 'HOTEL' | 'PAQUETE' | 'SEGURO' | 'TRANSFER' | 'PENALIDAD';

export type ExpenseCategory = 
  | 'OPERATIVO_GENERAL'
  | 'FEE_EMISION'
  | 'PENALIDAD_AEREA'
  | 'COMISION_PASARELA'
  | 'TRASLADO'
  | 'HOTELERIA'
  | 'SERVICIO_TERCERO'
  | 'TRAMITES_VISAS'
  | 'OTROS_COSTOS';

export type ExpenseStatus = 'REGISTRADO' | 'PAGADO' | 'ANULADO';

// ============================================================================
// ENTIDADES DE DOMINIO
// ============================================================================

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: BankAccountType;
  currency: Currency;
  titularName: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CompanyContact {
  id: string;
  companyId: string;
  fullName: string;
  department?: string;
  roleTitle?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  legalName?: string;
  nit?: string;
  relationType: RelationType;
  accountType: AccountCategory;
  rating: AccountRating;
  department?: string;
  city?: string;
  address?: string;
  phone?: string;
  cellphone?: string;
  email?: string;
  webPage?: string;
  status: 'ACTIVO' | 'INACTIVO';
  createdAt: string | Date;
  updatedAt: string | Date;
  contacts?: CompanyContact[];
}

export interface DebitNoteItem {
  id: string;
  debitNoteId: string;
  serviceType: ServiceType;
  ticketId?: string;
  ticketNumber?: string;
  passengerName: string;
  passengerDocId?: string;
  operatorId?: string;
  operatorName?: string;
  description: string;
  currency: Currency;
  totalAmount: number;
  feeAmount: number;
  providerCommissionRate: number;
  providerCommissionAmount: number;
  clientCommissionRate: number;
  clientCommissionAmount: number;
  netCostToProvider: number;
  createdAt?: string | Date;
}

export interface DebitNote {
  id: string;
  ndNumber: number;
  accountId: string;
  accountName: string;
  accountNit?: string;
  requesterId?: string | null;
  solicitante: string;
  passengerName?: string;
  issueDate: string;
  dueDate?: string;
  paymentTerm: PaymentTerm;
  currency: Currency;
  totalAmountBob: number;
  totalAmountUsd: number;
  paidAmountBob: number;
  paidAmountUsd: number;
  balanceBob: number;
  balanceUsd: number;
  status: DebitNoteStatus;
  observations?: string;
  createdById?: string;
  createdByName?: string;
  items: DebitNoteItem[];
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: Currency;
  exchangeRate: number;
  ticketId?: string | null;
  debitNoteId?: string | null;
  supplierAccountId?: string | null;
  bankAccountId?: string | null;
  receiptVoucher?: string;
  expenseDate: string;
  createdById: string;
  status: ExpenseStatus;
  observations?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// ============================================================================
// DTOs (DATA TRANSFER OBJECTS) PARA APIS Y SERVER ACTIONS
// ============================================================================

export interface CreateBankAccountDTO {
  bankName: string;
  accountNumber: string;
  accountType: BankAccountType;
  currency: Currency;
  titularName: string;
  isActive?: boolean;
}

export interface UpdateBankAccountDTO {
  bankName?: string;
  accountNumber?: string;
  accountType?: BankAccountType;
  currency?: Currency;
  titularName?: string;
  isActive?: boolean;
}

export interface CreateCompanyContactDTO {
  companyId: string;
  fullName: string;
  department?: string;
  roleTitle?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
}

export interface UpdateCompanyContactDTO {
  fullName?: string;
  department?: string;
  roleTitle?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
}

export interface CreateExpenseDTO {
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: Currency;
  exchangeRate?: number;
  ticketId?: string;
  debitNoteId?: string;
  supplierAccountId?: string;
  bankAccountId?: string;
  receiptVoucher?: string;
  expenseDate: string;
  status?: ExpenseStatus;
  observations?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    details?: any;
  };
}
