#[derive(Debug, Clone)]
pub struct SubtensorEnvironment;

impl ink::env::Environment for SubtensorEnvironment {
    const MAX_EVENT_TOPICS: usize = 4;

    type AccountId = ink::primitives::AccountId;
    type Balance = u64;
    type Hash = ink::primitives::Hash;
    type BlockNumber = u32;
    type Timestamp = u64;
    type ChainExtension = ink::env::NoChainExtension;
}

#[ink::contract(env = crate::SubtensorEnvironment)]
mod relic_settlement {
    use ink::env::{hash::Blake2x256, hash::HashOutput, ReturnFlags};
    use ink::storage::Mapping;
    use scale::Encode;

    pub type RelicKey = [u8; 32];

    #[derive(Clone, Debug, PartialEq, Eq)]
    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[cfg_attr(feature = "std", derive(ink::storage::traits::StorageLayout))]
    pub struct Listing {
        pub seller: AccountId,
        pub price: Balance,
        pub expires_at: BlockNumber,
        pub ownership_nonce: u64,
    }

    #[derive(Clone, Debug, PartialEq, Eq)]
    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    pub enum Error {
        AlreadyRegistered,
        NotRegistered,
        NotOwner,
        InvalidOwner,
        InvalidPrice,
        InvalidExpiry,
        NotListed,
        ListingExpired,
        StaleListing,
        WrongPayment,
        SellerCannotBuy,
        PaymentFailed,
    }

    #[ink(event)]
    pub struct Registered {
        #[ink(topic)]
        relic: RelicKey,
        #[ink(topic)]
        owner: AccountId,
        mint_nonce: [u8; 32],
        content_hash: [u8; 32],
    }

    #[ink(event)]
    pub struct Listed {
        #[ink(topic)]
        relic: RelicKey,
        #[ink(topic)]
        seller: AccountId,
        price: Balance,
        expires_at: BlockNumber,
        ownership_nonce: u64,
    }

    #[ink(event)]
    pub struct ListingCancelled {
        #[ink(topic)]
        relic: RelicKey,
        #[ink(topic)]
        seller: AccountId,
    }

    #[ink(event)]
    pub struct Transferred {
        #[ink(topic)]
        relic: RelicKey,
        from: AccountId,
        #[ink(topic)]
        to: AccountId,
        ownership_nonce: u64,
    }

    #[ink(event)]
    pub struct Purchased {
        #[ink(topic)]
        relic: RelicKey,
        seller: AccountId,
        #[ink(topic)]
        buyer: AccountId,
        price: Balance,
        ownership_nonce: u64,
    }

    #[ink(storage)]
    pub struct RelicSettlement {
        owners: Mapping<RelicKey, AccountId>,
        ownership_nonces: Mapping<RelicKey, u64>,
        listings: Mapping<RelicKey, Listing>,
    }

    impl RelicSettlement {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                owners: Mapping::default(),
                ownership_nonces: Mapping::default(),
                listings: Mapping::default(),
            }
        }

        /// Registers the contract-owned side of a v2 mint. The reference indexer
        /// recognizes this key only when the call shares one successful batch_all
        /// with the alpha burn and canonical Relic manifest.
        #[ink(message)]
        pub fn register_v2(
            &mut self,
            mint_nonce: [u8; 32],
            content_hash: [u8; 32],
        ) -> Result<RelicKey, Error> {
            let caller = self.env().caller();
            let relic = Self::derive_relic_key(&caller, mint_nonce, content_hash);
            if self.owners.contains(relic) {
                return Err(Error::AlreadyRegistered);
            }
            self.owners.insert(relic, &caller);
            self.ownership_nonces.insert(relic, &0u64);
            self.env().emit_event(Registered {
                relic,
                owner: caller,
                mint_nonce,
                content_hash,
            });
            Ok(relic)
        }

        #[ink(message)]
        pub fn transfer(&mut self, relic: RelicKey, to: AccountId) -> Result<(), Error> {
            let caller = self.env().caller();
            self.ensure_owner(relic, &caller)?;
            if to == AccountId::from([0u8; 32]) || to == caller {
                return Err(Error::InvalidOwner);
            }
            let next_nonce = self.ownership_nonce_of(relic).saturating_add(1);
            self.owners.insert(relic, &to);
            self.ownership_nonces.insert(relic, &next_nonce);
            self.listings.remove(relic);
            self.env().emit_event(Transferred {
                relic,
                from: caller,
                to,
                ownership_nonce: next_nonce,
            });
            Ok(())
        }

        #[ink(message)]
        pub fn list(
            &mut self,
            relic: RelicKey,
            price: Balance,
            expires_at: BlockNumber,
        ) -> Result<(), Error> {
            let seller = self.env().caller();
            self.ensure_owner(relic, &seller)?;
            if price == 0 {
                return Err(Error::InvalidPrice);
            }
            if expires_at <= self.env().block_number() {
                return Err(Error::InvalidExpiry);
            }
            let ownership_nonce = self.ownership_nonce_of(relic);
            self.listings.insert(
                relic,
                &Listing {
                    seller,
                    price,
                    expires_at,
                    ownership_nonce,
                },
            );
            self.env().emit_event(Listed {
                relic,
                seller,
                price,
                expires_at,
                ownership_nonce,
            });
            Ok(())
        }

        #[ink(message)]
        pub fn cancel_listing(&mut self, relic: RelicKey) -> Result<(), Error> {
            let caller = self.env().caller();
            self.ensure_owner(relic, &caller)?;
            if !self.listings.contains(relic) {
                return Err(Error::NotListed);
            }
            self.listings.remove(relic);
            self.env().emit_event(ListingCancelled {
                relic,
                seller: caller,
            });
            Ok(())
        }

        /// The only payable settlement entrypoint. Every validation failure uses
        /// REVERT so the buyer's attached TAO is returned by pallet-contracts.
        #[ink(message, payable)]
        pub fn buy(&mut self, relic: RelicKey) -> Result<(), Error> {
            let buyer = self.env().caller();
            let payment = self.env().transferred_value();
            let listing = match self.validate_purchase(relic, &buyer, payment) {
                Ok(listing) => listing,
                Err(error) => Self::revert(error),
            };

            if self
                .env()
                .transfer(listing.seller, listing.price)
                .is_err()
            {
                Self::revert(Error::PaymentFailed);
            }

            let next_nonce = self.finalize_purchase(relic, &buyer, &listing);
            self.env().emit_event(Purchased {
                relic,
                seller: listing.seller,
                buyer,
                price: listing.price,
                ownership_nonce: next_nonce,
            });
            Ok(())
        }

        #[ink(message)]
        pub fn owner_of(&self, relic: RelicKey) -> Option<AccountId> {
            self.owners.get(relic)
        }

        #[ink(message)]
        pub fn ownership_nonce_of(&self, relic: RelicKey) -> u64 {
            self.ownership_nonces.get(relic).unwrap_or(0)
        }

        #[ink(message)]
        pub fn listing_of(&self, relic: RelicKey) -> Option<Listing> {
            self.listings.get(relic)
        }

        #[ink(message)]
        pub fn relic_key(
            &self,
            owner: AccountId,
            mint_nonce: [u8; 32],
            content_hash: [u8; 32],
        ) -> RelicKey {
            Self::derive_relic_key(&owner, mint_nonce, content_hash)
        }

        fn derive_relic_key(
            owner: &AccountId,
            mint_nonce: [u8; 32],
            content_hash: [u8; 32],
        ) -> RelicKey {
            let input = (
                b"BITTENSOR_RELICS_SETTLEMENT_V2",
                owner,
                mint_nonce,
                content_hash,
            )
                .encode();
            let mut output = <Blake2x256 as HashOutput>::Type::default();
            ink::env::hash_bytes::<Blake2x256>(&input, &mut output);
            output
        }

        fn ensure_owner(&self, relic: RelicKey, caller: &AccountId) -> Result<(), Error> {
            match self.owners.get(relic) {
                None => Err(Error::NotRegistered),
                Some(owner) if owner != *caller => Err(Error::NotOwner),
                Some(_) => Ok(()),
            }
        }

        fn validate_purchase(
            &self,
            relic: RelicKey,
            buyer: &AccountId,
            payment: Balance,
        ) -> Result<Listing, Error> {
            let listing = self.listings.get(relic).ok_or(Error::NotListed)?;
            if listing.expires_at <= self.env().block_number() {
                return Err(Error::ListingExpired);
            }
            if listing.seller == *buyer {
                return Err(Error::SellerCannotBuy);
            }
            if self.owners.get(relic) != Some(listing.seller)
                || self.ownership_nonce_of(relic) != listing.ownership_nonce
            {
                return Err(Error::StaleListing);
            }
            if payment != listing.price {
                return Err(Error::WrongPayment);
            }
            Ok(listing)
        }

        fn finalize_purchase(
            &mut self,
            relic: RelicKey,
            buyer: &AccountId,
            listing: &Listing,
        ) -> u64 {
            let next_nonce = listing.ownership_nonce.saturating_add(1);
            self.owners.insert(relic, buyer);
            self.ownership_nonces.insert(relic, &next_nonce);
            self.listings.remove(relic);
            next_nonce
        }

        fn revert(error: Error) -> ! {
            ink::env::return_value::<Result<(), Error>>(ReturnFlags::REVERT, &Err(error))
        }
    }

    impl Default for RelicSettlement {
        fn default() -> Self {
            Self::new()
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use ink::env::test;

        fn accounts() -> test::DefaultAccounts<crate::SubtensorEnvironment> {
            test::default_accounts::<crate::SubtensorEnvironment>()
        }

        fn register(contract: &mut RelicSettlement, owner: AccountId) -> RelicKey {
            test::set_caller::<crate::SubtensorEnvironment>(owner);
            contract.register_v2([7u8; 32], [9u8; 32]).unwrap()
        }

        #[ink::test]
        fn validated_purchase_moves_ownership_once() {
            let accounts = accounts();
            let mut contract = RelicSettlement::new();
            let relic = register(&mut contract, accounts.alice);
            test::set_caller::<crate::SubtensorEnvironment>(accounts.alice);
            contract.list(relic, 1_000_000_000, 100).unwrap();

            let listing = contract
                .validate_purchase(relic, &accounts.bob, 1_000_000_000)
                .unwrap();
            assert_eq!(
                contract.finalize_purchase(relic, &accounts.bob, &listing),
                1
            );

            assert_eq!(contract.owner_of(relic), Some(accounts.bob));
            assert_eq!(contract.ownership_nonce_of(relic), 1);
            assert_eq!(contract.listing_of(relic), None);
        }

        #[ink::test]
        fn transfer_invalidates_the_listing_before_purchase() {
            let accounts = accounts();
            let mut contract = RelicSettlement::new();
            let relic = register(&mut contract, accounts.alice);
            test::set_caller::<crate::SubtensorEnvironment>(accounts.alice);
            contract.list(relic, 50, 100).unwrap();
            contract.transfer(relic, accounts.bob).unwrap();
            assert_eq!(contract.listing_of(relic), None);
            assert_eq!(
                contract.validate_purchase(relic, &accounts.charlie, 50),
                Err(Error::NotListed)
            );
        }

        #[ink::test]
        fn wrong_payment_expiry_and_self_purchase_fail_before_transfer() {
            let accounts = accounts();
            let mut contract = RelicSettlement::new();
            let relic = register(&mut contract, accounts.alice);
            test::set_caller::<crate::SubtensorEnvironment>(accounts.alice);
            contract.list(relic, 100, 10).unwrap();
            assert_eq!(
                contract.validate_purchase(relic, &accounts.bob, 99),
                Err(Error::WrongPayment)
            );
            assert_eq!(
                contract.validate_purchase(relic, &accounts.alice, 100),
                Err(Error::SellerCannotBuy)
            );
            test::set_block_number::<crate::SubtensorEnvironment>(10);
            assert_eq!(
                contract.validate_purchase(relic, &accounts.bob, 100),
                Err(Error::ListingExpired)
            );
            assert_eq!(contract.owner_of(relic), Some(accounts.alice));
        }

        #[ink::test]
        fn duplicate_registration_and_non_owner_listing_are_rejected() {
            let accounts = accounts();
            let mut contract = RelicSettlement::new();
            let relic = register(&mut contract, accounts.alice);
            assert_eq!(
                contract.register_v2([7u8; 32], [9u8; 32]),
                Err(Error::AlreadyRegistered)
            );
            test::set_caller::<crate::SubtensorEnvironment>(accounts.bob);
            assert_eq!(contract.list(relic, 100, 10), Err(Error::NotOwner));
        }
    }
}
