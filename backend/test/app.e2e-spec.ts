import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  const ts = Date.now();

  const login = async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'luis', password: '585858' })
      .expect(201);
    return res.body.access_token as string;
  };

  const createAccount = (code: string, name: string, relationType: string) =>
    request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        code,
        name,
        relationType,
        accountType: 'EMPRESA',
      })
      .expect(201);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    token = await login();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'online', service: 'maretravel-backend' });
  });

  it('recorre el flujo financiero completo: cuenta -> ND -> cerrar -> NC -> pagar -> cuadrar', async () => {
    const client = await createAccount(`CLI-${ts}`, 'Cliente Test e2e', 'CLIENTE');
    const provider = await createAccount(
      `PROV-${ts}`,
      'Proveedor Operador e2e',
      'PROVEEDOR',
    );

    const ticket = await request(app.getHttpServer())
      .post('/api/gds-tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ticketNumber: `TK-${ts}`,
        gdsSource: 'AMADEUS',
        issueDate: '2026-09-18',
        passengerName: 'Pasajero e2e',
        route: 'VVI-MAD',
        airlineCode: 'BOA',
        operatorId: provider.body.id,
        netAmount: 100,
        taxAmount: 20,
        totalAmount: 120,
        currency: 'BOB',
      })
      .expect(201);
    expect(ticket.body.id).toBeDefined();

    const nd = await request(app.getHttpServer())
      .post('/api/debit-notes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: client.body.id,
        issueDate: '2026-09-18',
        paymentTerm: 'AL_CONTADO',
        currency: 'BOB',
        items: [
          {
            serviceType: 'BOLETO_GDS',
            passengerName: 'Pasajero e2e',
            description: 'Boleto VVI-MAD',
            currency: 'BOB',
            totalAmount: 120,
            ticketId: ticket.body.id,
            operatorId: provider.body.id,
          },
        ],
      })
      .expect(201);
    expect(nd.body.id).toBeDefined();
    const ndId = nd.body.id;

    await request(app.getHttpServer())
      .post(`/api/debit-notes/${ndId}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    const closed = await request(app.getHttpServer())
      .get(`/api/debit-notes/${ndId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(closed.body.status).toBe('IMPAGA');
    expect(Number(closed.body.totalAmountBob)).toBe(120);

    const creditNotes = await request(app.getHttpServer())
      .get('/api/credit-notes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const autoNc = creditNotes.body.find(
      (nc: any) => nc.isAutomatic && nc.debitNoteId === ndId,
    );
    expect(autoNc).toBeDefined();
    expect(autoNc.providerAccountId).toBe(provider.body.id);

    await request(app.getHttpServer())
      .post('/api/cash-receipts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientAccountId: client.body.id,
        issueDate: '2026-09-18',
        lines: [
          {
            debitNoteId: ndId,
            amountPaidBob: Number(closed.body.balanceBob),
            amountPaidUsd: Number(closed.body.balanceUsd),
          },
        ],
      })
      .expect(201);

    const paid = await request(app.getHttpServer())
      .get(`/api/debit-notes/${ndId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(paid.body.status).toBe('PAGADA');
    expect(Number(paid.body.balanceBob)).toBe(0);
    expect(Number(paid.body.balanceUsd)).toBe(0);
  });
});