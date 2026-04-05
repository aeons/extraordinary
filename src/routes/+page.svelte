<script lang="ts">
	import { calculateMortgage, TAX_DEDUCTION_RATE } from '$lib/mortgage';

	// ── Input state ───────────────────────────────────────────────────────────
	let remainingAmount = $state(2_000_000);
	let remainingYears = $state(20);
	let interestRate = $state(4.0);
	let bidrag = $state(0.6);
	let extraPayment = $state(200_000);
	let fee = $state(0);

	// ── Derived result ────────────────────────────────────────────────────────
	let result = $derived(
		remainingAmount > 0 && remainingYears > 0 && extraPayment > 0
			? calculateMortgage({
					remainingAmount,
					remainingYears,
					interestRate,
					bidrag,
					extraPayment,
					fee
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
						bind:value={remainingAmount}
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
						bind:value={remainingYears}
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
						bind:value={interestRate}
					/>
					<span class="unit">% p.a.</span>
				</div>
			</div>

			<div class="field">
				<label for="bidrag">Bidragssats</label>
				<div class="input-wrap">
					<input
						id="bidrag"
						type="number"
						min="0"
						max="5"
						step="0.01"
						bind:value={bidrag}
					/>
					<span class="unit">% p.a.</span>
				</div>
			</div>

			<h2 class="section-divider">Ekstraordinær betaling</h2>

			<div class="field">
				<label for="extraPayment">Ekstraordinær betaling</label>
				<div class="input-wrap">
					<input
						id="extraPayment"
						type="number"
						min="0"
						step="10000"
						bind:value={extraPayment}
					/>
					<span class="unit">kr.</span>
				</div>
			</div>

			<div class="field">
				<label for="fee">Gebyr (valgfrit)</label>
				<div class="input-wrap">
					<input
						id="fee"
						type="number"
						min="0"
						step="100"
						bind:value={fee}
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
						<div class="stat">
							<dt>Samlet betaling inkl. gebyr</dt>
							<dd>{dkk(result.totalCost)}</dd>
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
	}

	.stat.accent dd {
		color: #2b6cb0;
	}

	.stat.positive {
		background: #f0fff4;
	}

	.stat.positive dd {
		color: #276749;
	}

	.stat.negative {
		background: #fff5f5;
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
