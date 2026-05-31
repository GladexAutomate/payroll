import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ComplianceOverview from '@/components/compliance/ComplianceOverview';
import Report1601C from '@/components/compliance/Report1601C';
import AnnualReport from '@/components/compliance/AnnualReport';
import TinValidationReport from '@/components/compliance/TinValidationReport';

export default function TaxCompliance() {
  const [tab, setTab] = useState('overview');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Tax Compliance</h1>
          <p className="text-sm text-muted-foreground">BIR requirements computed from your payroll records</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="1601c">1601-C Monthly</TabsTrigger>
          <TabsTrigger value="1604c">1604-C Annual</TabsTrigger>
          <TabsTrigger value="2316">2316 Certificates</TabsTrigger>
          <TabsTrigger value="annualization">Tax Annualization</TabsTrigger>
          <TabsTrigger value="tin">TIN Validation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <ComplianceOverview />
        </TabsContent>
        <TabsContent value="1601c" className="mt-5">
          <Report1601C />
        </TabsContent>
        <TabsContent value="1604c" className="mt-5">
          <AnnualReport
            reportType="1604c"
            mode="1604c"
            description="Year-end summary of all employee compensation and taxes withheld for the calendar year."
          />
        </TabsContent>
        <TabsContent value="2316" className="mt-5">
          <AnnualReport
            reportType="2316"
            mode="1604c"
            description="Per-employee annual earnings and taxes withheld. Open any employee to view and print their BIR Form 2316."
            allowCertificate
          />
        </TabsContent>
        <TabsContent value="annualization" className="mt-5">
          <AnnualReport
            reportType="annualization"
            mode="annualization"
            description="Recomputes each employee's annual tax due vs. tax already withheld to determine a refund or additional collection."
          />
        </TabsContent>
        <TabsContent value="tin" className="mt-5">
          <TinValidationReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}