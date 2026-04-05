# extraordinary

A Danish mortgage extraordinary payment calculator built with [Vite+](https://viteplus.dev) and SvelteKit.

## What it does

This calculator helps homeowners understand the consequences of making an extraordinary (lump-sum) payment on their Danish mortgage (realkreditlån).

Given the following inputs (all user-facing labels are in Danish):

- **Restgæld** – remaining loan amount
- **Restløbetid** – remaining loan duration in years
- **Rente** – annual interest rate
- **Bidragssats** – annual service-fee rate (bidrag)
- **Ekstraordinær betaling** – the extraordinary payment amount
- **Gebyr** – optional fee charged for the extraordinary payment

The calculator computes:

1. **Mulighed 1 – Same remaining term, lower payment**: The loan runs for the same number of years but quarterly payments are reduced. Shows quarterly and annual savings, and total interest saved.
2. **Mulighed 2 – Same payment, shorter term**: Quarterly payments remain unchanged and the loan ends sooner. Shows how many quarters/years are saved and total interest saved.
3. **Tax impact (Skattemæssig påvirkning)**: Danish mortgage interest is tax-deductible (rentefradrag). The calculator shows the change in annual tax deduction caused by the reduced outstanding balance.

> All calculations are approximate. The loans are modelled as quarterly-paid annuity loans (annuitetslån). The tax deduction rate used is ~26%; the actual rate varies by year. Consult your bank or accountant for precise figures.

## Setup

Install the [Vite+](https://viteplus.dev) binary:

```sh
curl -fsSL https://vite.plus | bash
```

Install dependencies:

```sh
vp install
```

## Developing

Start the development server:

```sh
vp dev
```

## Building

Create a production build:

```sh
vp build
```

Preview the production build:

```sh
vp preview
```
