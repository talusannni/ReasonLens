import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {resolveDashboardWorkspaceId} from '../../lib/dashboard-auth';

export const dynamic = 'force-dynamic';

export default async function WorkspaceLayout({children}:{children:React.ReactNode}) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(({name,value})=>name+'='+value).join('; ');
  if (!cookieHeader) redirect('/login');

  const request = new Request('https://reasonlens.internal/workspace', {
    headers: {cookie: cookieHeader}
  });
  const workspaceId = await resolveDashboardWorkspaceId(request);
  if (!workspaceId) redirect('/login');

  return children;
}
