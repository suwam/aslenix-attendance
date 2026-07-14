const fs = require('fs');
let code = fs.readFileSync('src/routes/_app/check-in.tsx', 'utf8');

if (!code.includes('useDeviceStatus')) {
  code = code.replace('import { useAuth } from "@/lib/auth-context";', 'import { useAuth } from "@/lib/auth-context";\nimport { useDeviceStatus } from "@/hooks/use-device-status";');
}

const startStr = '  const [deviceStatus, setDeviceStatus] = useState<';
const endStr = '  return (\n    <>\n      <PageHeader title="Check-in"';

const startIdx = code.indexOf(startStr);
const endIdx = code.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  const replacement = `  const { deviceStatus, verifyBiometrics } = useDeviceStatus();

  if (deviceStatus === 'loading' || (loading && !today)) {
    return (
      <>
        <PageHeader title="Check-in" subtitle="Daily attendance" />
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      </>
    );
  }

  if (deviceStatus !== 'approved') {
    return (
      <>
        <PageHeader title="Check-in" subtitle="Daily attendance" />
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <ShieldX size={48} className="text-muted-foreground/50" />
          <h2 className="text-xl font-semibold">Device Registration Required</h2>
          <p className="text-sm text-muted-foreground">
            Please register your device using the prompt that appeared after login, or contact your administrator if you are pending approval.
          </p>
        </div>
      </>
    );
  }

`;
  
  code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
  fs.writeFileSync('src/routes/_app/check-in.tsx', code);
  console.log('Successfully updated check-in.tsx');
} else {
  console.log('Failed to find start or end bounds');
}
