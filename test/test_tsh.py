from pyethereum import tester
from datetime import datetime, date
import math

import pytest
slow = pytest.mark.slow

class TestBtcTx(object):

    CONTRACT = 'tryStoreHeaders.py'
    CONTRACT_GAS = 55000

    ETHER = 10 ** 18

    ANC_DEPTHS = [1, 4, 16, 64, 256, 1024, 4096, 16384, 65536]


    def setup_class(cls):
        cls.s = tester.state()
        cls.c = cls.s.abi_contract(cls.CONTRACT, endowment=2000*cls.ETHER)
        cls.snapshot = cls.s.snapshot()
        cls.seed = tester.seed

    def setup_method(self, method):
        self.s.revert(self.snapshot)
        tester.seed = self.seed

    @slow
    # @pytest.mark.skipif(True,reason='skip')
    def testAroundMoreDepths(self):
        heaviest = 260
        self.c.initAncestorDepths()

        for i in range(1, heaviest+1):
            self.c.testStoreB(i, i, i-1)
        self.c.testSetHeaviest(heaviest)


        forkStartBlock = 999000
        parentOfFork = 2
        numBlocksInFork = 3
        for i in range(numBlocksInFork):
            self.c.testStoreB(forkStartBlock+i, forkStartBlock+i, parentOfFork)
            parentOfFork = forkStartBlock


        finalAncIndex = int(math.ceil(math.log(heaviest) / math.log(4))) # log base 4 of heaviest
        # start at 1, instead of 0
        for i in range(1, finalAncIndex):
            depth = self.ANC_DEPTHS[i]
            print('@@@@@@@@@@@@@@@@@@@ depth: '+str(depth))
            assert self.c.inMainChain(depth-1) == [1]
            assert self.c.inMainChain(depth) == [1]
            assert self.c.inMainChain(depth+1) == [1]

        for i in range(numBlocksInFork):
            assert self.c.inMainChain(forkStartBlock+i) == [0]


    @pytest.mark.skipif(True,reason='skip')
    def testAroundSomeDepths(self):
        heaviest = 20
        self.c.initAncestorDepths()

        for i in range(1, heaviest+1):
            self.c.testStoreB(i, i, i-1)
        self.c.testSetHeaviest(heaviest)


        forkStartBlock = 999000
        parentOfFork = 2
        numBlocksInFork = 3
        for i in range(numBlocksInFork):
            self.c.testStoreB(forkStartBlock+i, forkStartBlock+i, parentOfFork)
            parentOfFork = forkStartBlock


        finalAncIndex = int(math.ceil(math.log(heaviest) / math.log(4))) # log base 4 of heaviest
        # start at 1, instead of 0
        for i in range(1, finalAncIndex):
            depth = self.ANC_DEPTHS[i]
            # print('@@@@@@@@@@@@@@@@@@@ depth: '+str(depth))
            assert self.c.inMainChain(depth-1) == [1]
            assert self.c.inMainChain(depth) == [1]
            assert self.c.inMainChain(depth+1) == [1]

        for i in range(numBlocksInFork):
            assert self.c.inMainChain(forkStartBlock+i) == [0]


    @pytest.mark.skipif(True,reason='skip')
    def testSmallChain(self):
        heaviest = 5
        self.c.initAncestorDepths()

        for i in range(1, heaviest+1):
            self.c.testStoreB(i, i, i-1)
        self.c.testSetHeaviest(heaviest)

        forkStartBlock = 999000
        parentOfFork = 2
        numBlocksInFork = 3
        for i in range(numBlocksInFork):
            self.c.testStoreB(forkStartBlock+i, forkStartBlock+i, parentOfFork)
            parentOfFork = forkStartBlock

        for i in range(1, heaviest+1):
            assert self.c.inMainChain(i) == [1]

        for i in range(numBlocksInFork):
            assert self.c.inMainChain(forkStartBlock+i) == [0]


    @pytest.mark.skipif(True,reason='skip')
    def testShortFork(self):
        heaviest = 5
        self.c.initAncestorDepths()

        for i in range(1, heaviest+1):
            self.c.testStoreB(i, i, i-1)
        self.c.testSetHeaviest(heaviest)

        self.c.testStoreB(30, 30, 2)
        self.c.testStoreB(31, 31, 30)
        self.c.testStoreB(32, 32, 31)

        for i in range(1, heaviest+1):
            assert self.c.inMainChain(i) == [1]

        assert self.c.inMainChain(30) == [0]
        assert self.c.inMainChain(31) == [0]
        assert self.c.inMainChain(32) == [0]

        # for i in range(1, heaviest+1):
        #     self.c.logAnc(i)

        # # self.c.logAnc(63)
        # # self.c.logAnc(64)
        # # self.c.logAnc(65)
        # # self.c.logAnc(66)
        #
        # self.c.logBlockchainHead()