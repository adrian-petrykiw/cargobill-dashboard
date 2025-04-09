// pages/banking/index.tsx

import ProtectedLayout from '@/components/layouts/ProtectedLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Copy } from 'lucide-react';

export default function Banking() {
  return (
    <ProtectedLayout title="Banking · CargoBill">
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Banking</h1>

        {/* Account Overview Section */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Bank Account Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-md font-medium">Bank Account</CardTitle>
              <Button variant="link" className="text-xs p-0 h-auto">
                Details
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-16">
                <p className="text-gray-500 mb-4 text-sm">Feature coming soon :)</p>
                <p className="text-gray-400 text-xs">
                  Banking features will enable you to manage your USD accounts and transactions
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Transfers Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-md font-medium">Transfers</CardTitle>
              <Button size="sm" className="h-8">
                New Transfer +
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-16">
                <p className="text-gray-500 mb-4 text-sm">No recent transfers</p>
                <p className="text-gray-400 text-xs">
                  Your recent ACH and wire transfers will appear here
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Details Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-medium">Account Details</h2>
          </div>

          <Card>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Account Number</h3>
                  <div className="flex items-center">
                    <p className="font-mono text-sm">••••••••9876</p>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-2">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Routing Number</h3>
                  <div className="flex items-center">
                    <p className="font-mono text-sm">••••••1234</p>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-2">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Account Type</h3>
                  <p className="text-sm">Business Checking</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Bank Name</h3>
                  <p className="text-sm">Wells Fargo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transfer History Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-medium">Transfer History</h2>
            <Button variant="link" className="text-xs p-0 h-auto">
              View all
            </Button>
          </div>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Date
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Type
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      To/From
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Description
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Status
                    </TableHead>
                    <TableHead className="text-xs uppercase text-gray-500 py-3 px-6">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-200">
                  <TableRow>
                    <TableCell className="text-center text-xs text-gray-500 py-4 px-6" colSpan={6}>
                      No transfers found
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </ProtectedLayout>
  );
}
