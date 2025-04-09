// pages/cards/index.tsx

import ProtectedLayout from '@/components/layouts/ProtectedLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Cards() {
  return (
    <ProtectedLayout title="Cards · CargoBill">
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Cards</h1>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-md font-medium">Your Cards</CardTitle>
            <Button size="sm" className="h-8">
              Request New Card
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-center py-16">
              <p className="text-gray-500 mb-4 text-sm">Feature coming soon :)</p>
              <p className="text-gray-400 text-xs">
                You'll be able to manage your physical and virtual debit cards here
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Virtual Cards Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-medium">Virtual Cards</h2>
            <Button variant="link" className="text-xs p-0 h-auto">
              Create Virtual Card
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="text-center py-10">
                <p className="text-gray-500 mb-4 text-sm">No virtual cards yet</p>
                <p className="text-gray-400 text-xs">
                  Virtual cards allow you to create temporary cards for specific vendors or expenses
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Physical Cards Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-medium">Physical Cards</h2>
            <Button variant="link" className="text-xs p-0 h-auto">
              Request Physical Card
            </Button>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="text-center py-10">
                <p className="text-gray-500 mb-4 text-sm">No physical cards yet</p>
                <p className="text-gray-400 text-xs">
                  Physical cards can be used at ATMs and point-of-sale terminals worldwide
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedLayout>
  );
}
