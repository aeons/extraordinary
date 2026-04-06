<script lang="ts">
	import { calculateMortgage, TAX_DEDUCTION_RATE } from '$lib/mortgage';
	import { useSearchParams } from 'runed/kit';
	import * as v from 'valibot';
	import type { BondInfo, BondRatesResponse } from './api/bond-rates/+server';

	// ── Schema (defines URL params, types, and fallback defaults) ────────────
	const schema = v.object({
		remainingAmount: v.optional(v.fallback(v.number(), 2_000_000), 2_000_000),
		remainingYears: v.optional(v.fallback(v.number(), 20), 20),
		interestRate: v.optional(v.fallback(v.number(), 4.0), 4.0),
		contributionRate: v.optional(v.fallback(v.number(), 0.6), 0.6),
		payment: v.optional(v.fallback(v.number(), 200_000), 200_000),
		bondRate: v.optional(v.fallback(v.number(), 100), 100),
		fee: v.optional(v.fallback(v.number(), 0), 0)
	});

	// ── Reactive URL search params (non-default values only; no history spam) ─
	const params = useSearchParams(schema, { pushHistory: false });

	// ── Bond rates (fetched from the prerendered Nasdaq Nordic API endpoint) ──
	let bonds = $state<BondInfo[]>([]);
	let bondRatesFetchedAt = $state<string | null>(null);
	let bondRatesError = $state<string | null>(null);
	let selectedBondId = $state('');

	// ── Bond rate input display state ─────────────────────────────────────────
	// Decoupled from params so clearing the input doesn't trigger the valibot
	// fallback and snap the value back to 100 before the user finishes typing.
	// `undefined` represents an empty / in-progress input (number inputs yield
	// undefined when the field is blank via bind:value).
	let bondRateDisplay = $state<number | undefined>(params.bondRate);

	// Keep display in sync when params change from an external source (e.g. a
	// bond is selected from the dropdown, or the URL changes).
	$effect(() => {
		bondRateDisplay = params.bondRate;
	});

	async function loadBondRates() {
		try {
			const res = await fetch('/api/bond-rates');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data: BondRatesResponse = await res.json();
			bonds = data.bonds;
			bondRatesFetchedAt = data.fetchedAt;
			bondRatesError = null;
		} catch (err) {
			bondRatesError = err instanceof Error ? err.message : String(err);
		}
	}

	function onBondSelect(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		selectedBondId = select.value;
		const bond = bonds.find((b) => b.orderbookId === selectedBondId);
		if (bond?.bondRate != null) {
			params.bondRate = bond.bondRate;
		}
	}

	// ── Derived result ────────────────────────────────────────────────────────
	let result = $derived(
		params.remainingAmount > 0 && params.remainingYears > 0 && params.payment > 0
			? calculateMortgage({
					remainingAmount: params.remainingAmount,
					remainingYears: params.remainingYears,
					interestRate: params.interestRate,
					contributionRate: params.contributionRate,
					payment: params.payment,
					bondRate: params.bondRate,
					fee: params.fee
				})
			: null
	);

	// ── Formatters ────────────────────────────────────────────────────────────
	function dkk(amount: number): string {
		return new Intl.NumberFormat('da-DK', {
			style: 'currency',
			currency: 'DKK',
			maximumFractionDigits: 0
		}).format(amount);
	}

	function num(n: number, decimals = 1): string {
		return new Intl.NumberFormat('da-DK', {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		}).format(n);
	}

	function sign(n: number): string {
		return n > 0 ? '+' : '';
	}

	function formatDate(iso: string): string {
		return new Intl.DateTimeFormat('da-DK', {
			dateStyle: 'short',
			timeStyle: 'short'
		}).format(new Date(iso));
	}
</script>

<svelte:head>
	<title>Ekstraordinær betaling – Realkreditlån</title>
</svelte:head>

<main>
	<header>
		<h1>Ekstraordinær betaling af realkreditlån</h1>
		<p class="subtitle">
			Beregn konsekvenserne ved en ekstraordinær indbetaling på dit realkreditlån
		</p>
	</header>

	<div class="layout">
		<!-- ── INPUT PANEL ──────────────────────────────────────────────────── -->
		<section class="card inputs">
			<h2>Låneoplysninger</h2>

			<div class="field">
				<label for="remainingAmount">Restgæld</label>
				<div class="input-wrap">
					<input
						id="remainingAmount"
						type="number"
						min="0"
						step="10000"
						bind:value={params.remainingAmount}
					/>
					<span class="unit">kr.</span>
				</div>
			</div>

			<div class="field">
				<label for="remainingYears">Restløbetid</label>
				<div class="input-wrap">
					<input
						id="remainingYears"
						type="number"
						min="1"
						max="30"
						step="1"
						bind:value={params.remainingYears}
					/>
					<span class="unit">år</span>
				</div>
			</div>

			<div class="field">
				<label for="interestRate">Rente</label>
				<div class="input-wrap">
					<input
						id="interestRate"
						type="number"
						min="0"
						max="20"
						step="0.1"
						bind:value={params.interestRate}
					/>
					<span class="unit">% p.a.</span>
				</div>
			</div>

			<div class="field">
				<label for="contributionRate">Bidragssats</label>
				<div class="input-wrap">
					<input
						id="contributionRate"
						type="number"
						min="0"
						max="5"
						step="0.01"
						bind:value={params.contributionRate}
					/>
					<span class="unit">% p.a.</span>
				</div>
			</div>

			<h2 class="section-divider">Ekstraordinær betaling</h2>

			<div class="field">
				<label for="payment">Ekstraordinær betaling</label>
				<div class="input-wrap">
					<input
						id="payment"
						type="number"
						min="0"
						step="10000"
						bind:value={params.payment}
					/>
					<span class="unit">kr.</span>
				</div>
			</div>

			<div class="field">
				<label for="bondRate">Kurs</label>
				<div class="bond-rate-row">
					<div class="input-wrap bond-rate-input">
						<input
							id="bondRate"
							type="number"
							min="1"
							max="130"
							step="0.01"
							bind:value={bondRateDisplay}
							oninput={() => {
								if (bondRateDisplay !== undefined && bondRateDisplay > 0) {
									params.bondRate = bondRateDisplay;
								}
							}}
						/>
					</div>
					<button
						type="button"
						class="fetch-btn"
						onclick={loadBondRates}
						aria-label={bondRatesFetchedAt ? 'Opdater kurser fra Nasdaq Copenhagen' : 'Hent aktuelle kurser fra Nasdaq Copenhagen'}
						title="Hent aktuelle kurser fra Nasdaq Copenhagen"
					>
						{#if bondRatesFetchedAt}
							↻ Opdater
						{:else}
							Hent kurser
						{/if}
					</button>
				</div>

				{#if bondRatesError}
					<p class="bond-error">Kurser ikke tilgængelige – udfyld manuelt.</p>
				{:else if bonds.length > 0}
					<div class="bond-select-wrap">
						<select
							id="bondSelect"
							class="bond-select"
							aria-label="Vælg obligation for at hente aktuel kurs"
							value={selectedBondId}
							onchange={onBondSelect}
						>
							<option value="">– Vælg obligation –</option>
							{#each bonds as bond}
								<option value={bond.orderbookId}>
									{bond.name}{bond.bondRate != null ? ` (kurs ${num(bond.bondRate, 2)})` : ''}
								</option>
							{/each}
						</select>
						{#if bondRatesFetchedAt}
							<p class="bond-timestamp">
								Opdateret: {formatDate(bondRatesFetchedAt)}
							</p>
						{/if}
					</div>
				{/if}
			</div>

			<div class="field">
				<label for="fee">Gebyr (valgfrit)</label>
				<div class="input-wrap">
					<input
						id="fee"
						type="number"
						min="0"
						step="100"
						bind:value={params.fee}
					/>
					<span class="unit">kr.</span>
				</div>
			</div>
		</section>

		<!-- ── RESULTS PANEL ────────────────────────────────────────────────── -->
		{#if result}
			<div class="results">
				<!-- Current loan summary -->
				<section class="card">
					<h2>Nuværende lån</h2>
					<dl class="stat-grid">
						<div class="stat">
							<dt>Kvartalsbetaling</dt>
							<dd>{dkk(result.currentQuarterlyPayment)}</dd>
						</div>
						<div class="stat">
							<dt>Årsrente (ca., 1. år)</dt>
							<dd>{dkk(result.currentAnnualInterest)}</dd>
						</div>
						<div class="stat">
							<dt>Skattefradrag ({num(TAX_DEDUCTION_RATE * 100, 0)}%)</dt>
							<dd>{dkk(result.currentAnnualTaxDeduction)}/år</dd>
						</div>
					</dl>
				</section>

				<!-- After payment summary -->
				<section class="card">
					<h2>Efter ekstraordinær betaling</h2>
					<dl class="stat-grid">
						<div class="stat accent">
							<dt>Ny restgæld</dt>
							<dd>{dkk(result.newRemainingAmount)}</dd>
						</div>
						<div class="stat positive">
							<dt>Gæld reduceret med (kurs {num(params.bondRate, 2)})</dt>
							<dd>{dkk(result.debtReduction)}</dd>
						</div>
					</dl>
				</section>

				<!-- Scenario 1 -->
				<section class="card scenario">
					<h2>
						<span class="badge">Mulighed 1</span>
						Samme løbetid – lavere ydelse
					</h2>
					<p class="scenario-desc">
						Lånet afvikles i det samme antal år, men de kvartalsvise betalinger reduceres.
					</p>
					<dl class="stat-grid">
						<div class="stat">
							<dt>Ny kvartalsbetaling</dt>
							<dd>{dkk(result.newQuarterlyPaymentSameTerm)}</dd>
						</div>
						<div class="stat positive">
							<dt>Besparelse pr. kvartal</dt>
							<dd>{dkk(result.quarterlyPaymentSaving)}</dd>
						</div>
						<div class="stat positive">
							<dt>Besparelse pr. år</dt>
							<dd>{dkk(result.annualPaymentSaving)}</dd>
						</div>
						<div class="stat positive">
							<dt>Samlet rentebesparelse</dt>
							<dd>{dkk(result.totalInterestSavedSameTerm)}</dd>
						</div>
					</dl>
				</section>

				<!-- Scenario 2 -->
				<section class="card scenario">
					<h2>
						<span class="badge">Mulighed 2</span>
						Samme ydelse – kortere løbetid
					</h2>
					<p class="scenario-desc">
						De kvartalsvise betalinger forbliver uændrede, og lånet afvikles hurtigere.
					</p>
					<dl class="stat-grid">
						<div class="stat">
							<dt>Ny restløbetid</dt>
							<dd>
								{result.newRemainingQuartersSamePayment} kvartaler ({num(
									result.newRemainingQuartersSamePayment / 4
								)} år)
							</dd>
						</div>
						<div class="stat positive">
							<dt>Løbetid forkortet med</dt>
							<dd>{result.quartersSaved} kvartaler ({num(result.yearsSaved)} år)</dd>
						</div>
						<div class="stat positive">
							<dt>Samlet rentebesparelse</dt>
							<dd>{dkk(result.totalInterestSavedSamePayment)}</dd>
						</div>
					</dl>
				</section>

				<!-- Tax impact -->
				<section class="card">
					<h2>Skattemæssig påvirkning</h2>
					<p class="tax-note">
						Kun renten er fradragsberettiget (rentefradrag, ca.
						{num(TAX_DEDUCTION_RATE * 100, 0)}%). Bidragsrenten giver ikke skattefradrag. Den
						ekstraordinære betaling reducerer restgælden og dermed den fradragsberettigede rente.
					</p>
					<dl class="stat-grid">
						<div class="stat">
							<dt>Ny årsrente (ca., 1. år)</dt>
							<dd>{dkk(result.newAnnualInterest)}</dd>
						</div>
						<div class="stat">
							<dt>Nyt skattefradrag</dt>
							<dd>{dkk(result.newAnnualTaxDeduction)}/år</dd>
						</div>
						<div class="stat {result.taxDeductionChange < 0 ? 'negative' : 'positive'}">
							<dt>Ændring i skattefradrag</dt>
							<dd>{sign(result.taxDeductionChange)}{dkk(result.taxDeductionChange)}/år</dd>
						</div>
					</dl>
					<p class="disclaimer">
						* Beregningerne er vejledende. Skattefradragssatsen varierer og aftrappes løbende.
						Kontakt din bank eller revisor for præcise tal.
					</p>
				</section>
			</div>
		{:else}
			<div class="results placeholder">
				<p>Udfyld oplysningerne til venstre for at se beregningen.</p>
			</div>
		{/if}
	</div>
</main>

<style>
	:global(*, *::before, *::after) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			sans-serif;
		background: #f4f6f9;
		color: #1a202c;
		line-height: 1.6;
	}

	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: 2rem 1rem 4rem;
	}

	/* ── Header ──────────────────────────────────────────────────────────── */
	header {
		text-align: center;
		margin-bottom: 2.5rem;
	}

	h1 {
		font-size: clamp(1.5rem, 4vw, 2.2rem);
		font-weight: 700;
		color: #1a365d;
		margin-bottom: 0.5rem;
	}

	.subtitle {
		font-size: 1rem;
		color: #4a5568;
	}

	/* ── Layout ──────────────────────────────────────────────────────────── */
	.layout {
		display: grid;
		grid-template-columns: 340px 1fr;
		gap: 1.5rem;
		align-items: start;
	}

	@media (max-width: 720px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	/* ── Card ────────────────────────────────────────────────────────────── */
	.card {
		background: #fff;
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
	}

	.card h2 {
		font-size: 1rem;
		font-weight: 600;
		color: #2d3748;
		margin-bottom: 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.section-divider {
		margin-top: 1.5rem;
	}

	/* ── Inputs ──────────────────────────────────────────────────────────── */
	.inputs h2 {
		border-bottom: 2px solid #ebf0f7;
		padding-bottom: 0.5rem;
		margin-bottom: 1rem;
	}

	.field {
		margin-bottom: 1rem;
	}

	.field label {
		display: block;
		font-size: 0.85rem;
		font-weight: 500;
		color: #4a5568;
		margin-bottom: 0.3rem;
	}

	.input-wrap {
		display: flex;
		align-items: center;
		border: 1.5px solid #cbd5e0;
		border-radius: 8px;
		overflow: hidden;
		transition: border-color 0.15s;
	}

	.input-wrap:focus-within {
		border-color: #3182ce;
		box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.15);
	}

	.input-wrap input {
		flex: 1;
		border: none;
		outline: none;
		padding: 0.55rem 0.75rem;
		font-size: 1rem;
		background: transparent;
		color: #1a202c;
		min-width: 0;
	}

	.input-wrap .unit {
		padding: 0.55rem 0.75rem;
		background: #edf2f7;
		color: #718096;
		font-size: 0.85rem;
		white-space: nowrap;
		border-left: 1.5px solid #cbd5e0;
	}

	/* ── Bond rate row ────────────────────────────────────────────────────── */
	.bond-rate-row {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
	}

	.bond-rate-input {
		flex: 1;
	}

	.fetch-btn {
		flex-shrink: 0;
		padding: 0.55rem 0.75rem;
		font-size: 0.85rem;
		font-weight: 500;
		border: 1.5px solid #cbd5e0;
		border-radius: 8px;
		background: #edf2f7;
		color: #2d3748;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 0.15s,
			border-color 0.15s;
	}

	.fetch-btn:hover {
		background: #e2e8f0;
		border-color: #a0aec0;
	}

	.bond-select-wrap {
		margin-top: 0.5rem;
	}

	.bond-select {
		width: 100%;
		padding: 0.45rem 0.65rem;
		font-size: 0.85rem;
		border: 1.5px solid #cbd5e0;
		border-radius: 8px;
		background: #fff;
		color: #1a202c;
		cursor: pointer;
	}

	.bond-select:focus {
		outline: none;
		border-color: #3182ce;
		box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.15);
	}

	.bond-timestamp {
		margin-top: 0.3rem;
		font-size: 0.75rem;
		color: #a0aec0;
	}

	.bond-error {
		margin-top: 0.35rem;
		font-size: 0.78rem;
		color: #c53030;
	}

	/* ── Results grid ────────────────────────────────────────────────────── */
	.results {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.results.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 200px;
		color: #718096;
		font-size: 1rem;
		text-align: center;
		background: #fff;
		border-radius: 12px;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
	}

	/* ── Stat grid ───────────────────────────────────────────────────────── */
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.75rem;
	}

	.stat {
		background: #f7fafc;
		border-radius: 8px;
		padding: 0.75rem 1rem;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
	}

	.stat dt {
		font-size: 0.78rem;
		font-weight: 500;
		color: #718096;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		margin-bottom: 0.25rem;
	}

	.stat dd {
		font-size: 1.1rem;
		font-weight: 700;
		color: #1a202c;
	}

	.stat.accent {
		background: #ebf8ff;
		box-shadow: 0 2px 8px rgba(49, 130, 206, 0.35);
	}

	.stat.accent dd {
		color: #2b6cb0;
	}

	.stat.positive {
		background: #f0fff4;
		box-shadow: 0 2px 8px rgba(56, 161, 105, 0.35);
	}

	.stat.positive dd {
		color: #276749;
	}

	.stat.negative {
		background: #fff5f5;
		box-shadow: 0 2px 8px rgba(229, 62, 62, 0.35);
	}

	.stat.negative dd {
		color: #c53030;
	}

	/* ── Scenarios ───────────────────────────────────────────────────────── */
	.scenario h2 {
		flex-wrap: wrap;
	}

	.badge {
		display: inline-block;
		background: #ebf0f7;
		color: #2c5282;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.scenario-desc {
		font-size: 0.875rem;
		color: #718096;
		margin-bottom: 1rem;
	}

	/* ── Tax section ─────────────────────────────────────────────────────── */
	.tax-note {
		font-size: 0.875rem;
		color: #4a5568;
		margin-bottom: 1rem;
		line-height: 1.5;
	}

	.disclaimer {
		margin-top: 1rem;
		font-size: 0.78rem;
		color: #a0aec0;
	}
</style>
