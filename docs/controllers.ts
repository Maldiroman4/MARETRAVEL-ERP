/**
 * MARETRAVEL ERP - Backend Controllers & Service Handlers
 * Implementación tipada con TypeScript, validación de esquemas Zod,
 * control de transacciones e integridad referencial.
 */

import { z } from 'zod';
import type { 
  BankAccount, 
  CompanyContact, 
  CreateBankAccountDTO, 
  UpdateBankAccountDTO, 
  CreateCompanyContactDTO, 
  UpdateCompanyContactDTO,
  ApiResponse 
} from './types';

// ============================================================================
// ESQUEMAS DE VALIDACIÓN ZOD
// ============================================================================

export const createBankAccountSchema = z.object({
  bankName: z.string().min(3, 'El nombre del banco debe tener al menos 3 caracteres'),
  accountNumber: z.string().min(5, 'El número de cuenta debe tener al menos 5 dígitos'),
  accountType: z.enum(['CORRIENTE', 'AHORROS', 'FONDO_ROTATORIO']),
  currency: z.enum(['BOB', 'USD']),
  titularName: z.string().min(3, 'El titular de la cuenta es obligatorio'),
  isActive: z.boolean().default(true)
});

export const updateBankAccountSchema = createBankAccountSchema.partial();

export const createCompanyContactSchema = z.object({
  companyId: z.string().uuid('ID de empresa inválido'),
  fullName: z.string().min(3, 'El nombre del contacto debe tener al menos 3 caracteres'),
  department: z.string().optional(),
  roleTitle: z.string().optional(),
  email: z.string().email('Formato de correo electrónico inválido').optional().or(z.literal('')),
  phone: z.string().min(6, 'Teléfono debe tener al menos 6 dígitos').optional().or(z.literal('')),
  isActive: z.boolean().default(true)
});

export const updateCompanyContactSchema = createCompanyContactSchema.partial().omit({ companyId: true });

// ============================================================================
// 1. CONTROLADOR DE CUENTAS BANCARIAS (BankAccountsController)
// ============================================================================

export class BankAccountsController {
  constructor(private readonly prisma: any) {}

  /**
   * GET /api/bank-accounts
   * Lista todas las cuentas bancarias con filtros opcionales
   */
  async list(currency?: 'BOB' | 'USD', isActive?: boolean): Promise<ApiResponse<BankAccount[]>> {
    try {
      const where: any = {};
      if (currency) where.currency = currency;
      if (typeof isActive === 'boolean') where.isActive = isActive;

      const accounts = await this.prisma.bankAccount.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { bankName: 'asc' }]
      });

      return {
        success: true,
        data: accounts
      };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', details: error.message }
      };
    }
  }

  /**
   * POST /api/bank-accounts
   * Registra una nueva cuenta bancaria
   */
  async create(body: CreateBankAccountDTO): Promise<ApiResponse<BankAccount>> {
    try {
      const validated = createBankAccountSchema.parse(body);

      // Verificar unicidad de cuenta en el mismo banco
      const existing = await this.prisma.bankAccount.findUnique({
        where: {
          bankName_accountNumber: {
            bankName: validated.bankName,
            accountNumber: validated.accountNumber
          }
        }
      });

      if (existing) {
        return {
          success: false,
          error: { code: 'DUPLICATE_ACCOUNT', details: 'Ya existe una cuenta con este número en la misma entidad bancaria' }
        };
      }

      const created = await this.prisma.bankAccount.create({
        data: validated
      });

      return {
        success: true,
        data: created,
        message: 'Cuenta bancaria creada exitosamente'
      };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', details: error.errors || error.message }
      };
    }
  }

  /**
   * PUT /api/bank-accounts/:id
   * Actualiza datos de una cuenta bancaria
   */
  async update(id: string, body: UpdateBankAccountDTO): Promise<ApiResponse<BankAccount>> {
    try {
      const validated = updateBankAccountSchema.parse(body);

      const updated = await this.prisma.bankAccount.update({
        where: { id },
        data: validated
      });

      return {
        success: true,
        data: updated,
        message: 'Cuenta bancaria actualizada correctamente'
      };
    } catch (error: any) {
      return {
        success: false,
        error: { code: 'UPDATE_FAILED', details: error.message }
      };
    }
  }

  /**
   * PATCH /api/bank-accounts/:id/toggle-status
   * Activa o desactiva la cuenta en 1-click
   */
  async toggleStatus(id: string): Promise<ApiResponse<BankAccount>> {
    try {
      const account = await this.prisma.bankAccount.findUnique({ where: { id } });
      if (!account) {
        return { success: false, error: { code: 'NOT_FOUND', details: 'Cuenta no encontrada' } };
      }

      const updated = await this.prisma.bankAccount.update({
        where: { id },
        data: { isActive: !account.isActive }
      });

      return {
        success: true,
        data: updated,
        message: `Cuenta ${updated.isActive ? 'activada' : 'desactivada'} exitosamente`
      };
    } catch (error: any) {
      return { success: false, error: { code: 'TOGGLE_FAILED', details: error.message } };
    }
  }

  /**
   * DELETE /api/bank-accounts/:id
   * Eliminación segura verificando integridad referencial
   */
  async delete(id: string): Promise<ApiResponse<null>> {
    try {
      // Verificar si tiene transacciones vinculadas (gastos o recibos de caja)
      const linkedExpenses = await this.prisma.expense.count({ where: { bankAccountId: id } });
      if (linkedExpenses > 0) {
        return {
          success: false,
          error: {
            code: 'REFERENTIAL_INTEGRITY_VIOLATION',
            details: 'No se puede eliminar la cuenta porque registra movimientos contables asociados. Se recomienda desactivarla.'
          }
        };
      }

      await this.prisma.bankAccount.delete({ where: { id } });
      return {
        success: true,
        message: 'Cuenta bancaria eliminada'
      };
    } catch (error: any) {
      return { success: false, error: { code: 'DELETE_FAILED', details: error.message } };
    }
  }
}

// ============================================================================
// 2. CONTROLADOR DE CONTACTOS DE EMPRESA (CompanyContactsController)
// ============================================================================

export class CompanyContactsController {
  constructor(private readonly prisma: any) {}

  /**
   * GET /api/companies/:companyId/contacts
   * Obtiene los contactos autorizados de una empresa
   */
  async listByCompany(companyId: string): Promise<ApiResponse<CompanyContact[]>> {
    try {
      const contacts = await this.prisma.companyContact.findMany({
        where: { companyId },
        orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }]
      });

      return { success: true, data: contacts };
    } catch (error: any) {
      return { success: false, error: { code: 'DATABASE_ERROR', details: error.message } };
    }
  }

  /**
   * POST /api/companies/:companyId/contacts
   * Registra un nuevo solicitante para la empresa
   */
  async create(companyId: string, body: Omit<CreateCompanyContactDTO, 'companyId'>): Promise<ApiResponse<CompanyContact>> {
    try {
      const validated = createCompanyContactSchema.parse({ ...body, companyId });

      const contact = await this.prisma.companyContact.create({
        data: validated
      });

      return {
        success: true,
        data: contact,
        message: 'Solicitante autorizado registrado con éxito'
      };
    } catch (error: any) {
      return { success: false, error: { code: 'VALIDATION_ERROR', details: error.errors || error.message } };
    }
  }

  /**
   * PUT /api/company-contacts/:id
   * Actualiza los datos del solicitante
   */
  async update(id: string, body: UpdateCompanyContactDTO): Promise<ApiResponse<CompanyContact>> {
    try {
      const validated = updateCompanyContactSchema.parse(body);

      const contact = await this.prisma.companyContact.update({
        where: { id },
        data: validated
      });

      return { success: true, data: contact, message: 'Contacto actualizado' };
    } catch (error: any) {
      return { success: false, error: { code: 'UPDATE_FAILED', details: error.message } };
    }
  }

  /**
   * PATCH /api/company-contacts/:id/toggle-status
   * Alterna estado activo/inactivo
   */
  async toggleStatus(id: string): Promise<ApiResponse<CompanyContact>> {
    try {
      const contact = await this.prisma.companyContact.findUnique({ where: { id } });
      if (!contact) {
        return { success: false, error: { code: 'NOT_FOUND', details: 'Contacto no encontrado' } };
      }

      const updated = await this.prisma.companyContact.update({
        where: { id },
        data: { isActive: !contact.isActive }
      });

      return {
        success: true,
        data: updated,
        message: `Contacto ${updated.isActive ? 'activado' : 'desactivado'}`
      };
    } catch (error: any) {
      return { success: false, error: { code: 'TOGGLE_FAILED', details: error.message } };
    }
  }

  /**
   * DELETE /api/company-contacts/:id
   * Eliminación con control de NDs vinculadas
   */
  async delete(id: string): Promise<ApiResponse<null>> {
    try {
      const ndCount = await this.prisma.debitNote.count({ where: { requesterId: id } });
      if (ndCount > 0) {
        return {
          success: false,
          error: {
            code: 'REFERENTIAL_RESTRICTION',
            details: 'El contacto tiene comprobantes de Nota de Débito vinculados. Desactívelo en lugar de eliminarlo.'
          }
        };
      }

      await this.prisma.companyContact.delete({ where: { id } });
      return { success: true, message: 'Contacto eliminado' };
    } catch (error: any) {
      return { success: false, error: { code: 'DELETE_FAILED', details: error.message } };
    }
  }
}
