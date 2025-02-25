import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    createAccount, getAccounts, addPrepaidProducts,
    getPrepaidProducts, consumePrepaidProduct, addAccumulatedItems,
    makePayment, closeAccount, getAccountReport,
    getAccount, getAccountTransactions, addAccountTransaction,
    cancelAccountTransaction
} from '../controllers/accountController';

const router = Router();

router.post('/', authenticate, createAccount);
router.get('/', authenticate, getAccounts);
router.post('/:id/prepaid-products', authenticate, addPrepaidProducts);
router.get('/:id/prepaid-products', authenticate, getPrepaidProducts);
router.post('/:id/consume', authenticate, consumePrepaidProduct);
router.post('/:id/accumulated-items', authenticate, addAccumulatedItems);
router.post('/:id/payment', authenticate, makePayment);
router.post('/:id/close', authenticate, closeAccount);
router.get('/:id/report', authenticate, getAccountReport);
router.get('/:id', authenticate, getAccount);
router.get('/:id/transactions', authenticate, getAccountTransactions);
router.post('/:id/transactions', authenticate, addAccountTransaction);
router.put('/:accountId/transactions/:transactionId/cancel', authenticate, cancelAccountTransaction);


export default router;