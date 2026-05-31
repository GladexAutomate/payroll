const REQUIREMENTS = [
  {
    code: '1601-C Filing',
    term: 'Monthly Employee Tax Filing',
    explanation: "Reporting and remitting the income tax withheld from employees' salaries every month.",
    tags: ['BIR EFPS'],
    status: 'available',
  },
  {
    code: '0619-E Filing',
    term: 'Monthly Supplier Tax Payment (EWT)',
    explanation: 'Remittance of withholding tax deducted from suppliers, contractors, consultants, landlords, and other service providers for the first two months of the quarter.',
    tags: ['BIR Online Registration'],
    status: 'needs_data',
  },
  {
    code: '0619-F Filing',
    term: 'Monthly Final Tax Payment',
    explanation: 'Remittance of final withholding taxes deducted from certain income payments subject to final tax.',
    tags: ['BIR EFPS'],
    status: 'needs_data',
  },
  {
    code: '1604-C Filing',
    term: 'Annual Employee Tax Summary',
    explanation: 'Year-end report summarizing all employee compensation and taxes withheld during the year.',
    tags: ['MPM'],
    status: 'available',
  },
  {
    code: '2316 Distribution',
    term: 'Issuance of Employee Tax Certificates',
    explanation: 'Providing employees with their BIR Form 2316, which shows their annual earnings and taxes withheld.',
    tags: ['Mercans Global'],
    status: 'available',
  },
  {
    code: 'TIN Validation',
    term: 'Employee TIN Checking',
    explanation: "Verifying that employees' Tax Identification Numbers (TINs) are correct and registered with the BIR.",
    tags: [],
    status: 'available',
  },
  {
    code: 'Tax Annualization',
    term: 'Year-End Tax Reconciliation',
    explanation: "Recomputing an employee's total annual income tax to determine if there is additional tax to deduct or tax refund to return.",
    tags: ['MPM Consulting'],
    status: 'available',
  },
];

const STATUS_BADGE = {
  available: { label: 'Computable now', cls: 'bg-green-50 text-green-700 border-green-200' },
  needs_data: { label: 'Needs supplier module', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default function ComplianceOverview() {
  return (
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
            {REQUIREMENTS.map((req) => (
              <tr key={req.code} className="border-b border-border/50 hover:bg-muted/30 transition-colors align-top">
                <td className="py-4 px-4">
                  <p className="font-semibold">{req.code}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 mt-1.5 rounded text-[11px] font-medium border ${STATUS_BADGE[req.status].cls}`}>
                    {STATUS_BADGE[req.status].label}
                  </span>
                </td>
                <td className="py-4 px-4 font-medium">{req.term}</td>
                <td className="py-4 px-4 text-muted-foreground">
                  <p>{req.explanation}</p>
                  {req.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {req.tags.map((tag) => (
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
  );
}