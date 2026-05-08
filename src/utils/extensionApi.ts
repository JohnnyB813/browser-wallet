import browser from 'webextension-polyfill';

export interface PendingApproval {
  action: string;
  origin: string;
  to?: string;
  amount?: string;
  from?: string;
}

export async function getPendingApproval(): Promise<PendingApproval | null> {
  try {
    const result = await browser.storage.local.get('pendingApproval');
    if (result.pendingApproval) {
      return JSON.parse(result.pendingApproval as string);
    }
    return null;
  } catch (error) {
    console.error('Error getting pending approval:', error);
    return null;
  }
}

export async function approveRequest(accounts?: string[], txHash?: string): Promise<boolean> {
  try {
    await browser.runtime.sendMessage({
      action: 'approveRequest',
      payload: { accounts, txHash },
    });
    await browser.storage.local.remove('pendingApproval');
    return true;
  } catch (error) {
    console.error('Error approving request:', error);
    return false;
  }
}

export async function rejectRequest(): Promise<boolean> {
  try {
    await browser.runtime.sendMessage({ action: 'rejectRequest' });
    await browser.storage.local.remove('pendingApproval');
    return true;
  } catch (error) {
    console.error('Error rejecting request:', error);
    return false;
  }
}