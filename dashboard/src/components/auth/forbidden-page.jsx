import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>403 Forbidden</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Kamu tidak punya izin untuk mengakses halaman ini. Hubungi admin jika butuh akses tambahan.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/", { replace: true })}>Kembali ke Dashboard</Button>
            <Button variant="outline" onClick={() => navigate(-1)}>Kembali</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
