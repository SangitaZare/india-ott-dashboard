import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface PlanCandidate {
  platformId: string;
  planName: string;
  pricePerMonth: number;
  billingPeriod?: string;
  maxQuality?: string;
}

interface PickerCombination {
  plans: PlanCandidate[];
  total: number;
  unverified: Array<{ platformId: string; need: string }>;
  size: number;
}

interface PickerResponse {
  status: 'ok' | 'no_match' | 'over_budget';
  best: PickerCombination | null;
  alternatives: PickerCombination[];
  cheapestValid: PickerCombination | null;
  excluded: Array<{ platformId: string; reasons: string[] }>;
}

interface PickerOptions {
  languages: string[];
  pricesChecked: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5235/api/picker';

  protected readonly languages = signal<string[]>([]);
  protected readonly selectedLanguages = signal<string[]>([]);
  protected readonly pricesChecked = signal('loading');
  protected readonly result = signal<PickerResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly apiError = signal('');

  protected screens = 1;
  protected adsOk = true;
  protected needsTv = false;
  protected cricket = false;
  protected budget: number | null = null;
  protected allowUnverified = false;

  constructor() {
    this.http.get<PickerOptions>(`${this.apiUrl}/options`).subscribe({
      next: (options) => {
        this.languages.set(options.languages);
        this.pricesChecked.set(options.pricesChecked);
      },
      error: () => {
        this.apiError.set('Could not connect to the ASP.NET Core API.');
        this.pricesChecked.set('unavailable');
      }
    });
  }

  protected toggleLanguage(language: string): void {
    const current = this.selectedLanguages();
    this.selectedLanguages.set(
      current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language]
    );
  }

  protected isLanguageSelected(language: string): boolean {
    return this.selectedLanguages().includes(language);
  }

  protected findPlans(): void {
    this.loading.set(true);
    this.apiError.set('');
    this.http.post<PickerResponse>(this.apiUrl, {
      screens: this.screens,
      adsOk: this.adsOk,
      needsTv: this.needsTv,
      languages: this.selectedLanguages(),
      cricket: this.cricket,
      budget: this.budget,
      allowUnverified: this.allowUnverified,
      people: this.screens
    }).subscribe({
      next: (response) => this.result.set(response),
      error: () => this.apiError.set('Could not calculate a plan combination.'),
      complete: () => this.loading.set(false)
    });
  }
}
