import { ShieldCheck } from 'lucide-react';

const REQUIREMENTS = [
  {
    code: '1601-C Filing',
    term: 'Monthly Employee Tax Filing',
    explanation: "Reporting and remitting the income tax withheld from employees' salaries every month.",
    tags: ['BIR EFPS'],
  },
  {
    code: '0619-E Filing',
    term: 'Monthly Supplier Tax Payment (EWT)',
    explanation: 'Remittance of withholding tax deducted from suppliers, contractors, consultants, landlords, and other service providers for the first two months of the quarter.',
    tags: ['BIR Online Registration'],
  },
  {
    code: '0619-F Filing',
    term: 'Monthly Final Tax Payment',
    explanation: 'Remittance of final withholding taxes deducted from certain income payments subject to final tax.',
    tags: ['BIR EFPS'],
  },
  {
    code: '1604-C Filing',
    term: 'Annual Employee Tax Summary',
    explanation: 'Year-end report summarizing all employee compensation and taxes withheld during the year.',
    tags: ['MPM'],
  },
  {
    code: '2316 Distribution',
    term: 'Issuance of Employee Tax Certificates',
    explanation: 'Providing employees with their BIR Form 2316, which shows their annual earnings and taxes withheld.',
    tags: ['Mercans Global'],
  },
  {
    code: 'TIN Validation',
    term: 'Employee TIN Checking',
    explanation: "Verifying that employees' Tax Identification Numbers (TINs) are correct and registered with the BIR.",
    tags: [],
  },
  {
    code: 'Tax Annualization',
    term: 'Year-End Tax Reconciliation',
    explanation: "Recomputing an employee's total annual income tax to determine if there is additional tax to deduct or tax refund to return.",
    tags: ['MPM Consulting'],
  },
];

export default function TaxCompliance() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Tax Compliance</h1>
          <p className="text-sm text-muted-foreground">BIR requirements and filing obligations</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide w-48">BIR Requirement</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide w-56">Layman's Term</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Simple Explanation</th>
              </tr>
            </thead>
            <tbody>
              {REQUIREMENTS.map(req => (
                <tr key={req.code} className="border-b border-border/50 hover:bg-muted/30 transition-colors align-top">
                  <td className="py-4 px-4 font-semibold">{req.code}</td>
                  <td className="py-4 px-4 font-medium">{req.term}</td>
                  <td className="py-4 px-4 text-muted-foreground">
                    <p>{req.explanation}</p>
                    {req.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {req.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-foreground/70 border border-border">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}